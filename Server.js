import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import scrapePTUKSchedules from "./src/services/ptukScraper.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// إعداد عميل Supabase بصلاحيات الإدارة لتجاوز RLS في عمليات الإدخال
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ خطأ: لم يتم العثور على SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY في ملف .env",
  );
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 1. مسار جلب المواد للواجهة مع تشكيل البيانات لتطابق محرك الجدولة
app.get("/api/courses", async (req, res) => {
  try {
    const { codes } = req.query;

    let query = supabase.from("courses").select(`
      code,
      name,
      type,
      sections (
        id,
        sec_number,
        instructor,
        room,
        building,
        status,
        section_blocks (
          day,
          start_hour,
          end_hour,
          raw_time
        )
      )
    `);

    if (codes) {
      const codeList = codes.split(",").map((c) => c.trim());
      query = query.in("code", codeList);
    }

    const { data, error } = await query;

    if (error) throw error;

    // إعادة هيكلة البيانات لتطابق النموذج المطلوب في الواجهة ومحرك الجدولة
    const formatted = data.map((course) => ({
      code: course.code,
      name: course.name,
      type: course.type,
      sections: (course.sections || []).map((sec) => {
        // تجميع الفترات الزمنية المكررة في نفس الشعبة إن وجدت
        const blockMap = new Map();
        (sec.section_blocks || []).forEach((b) => {
          const key = `${b.start_hour}-${b.end_hour}`;
          if (!blockMap.has(key)) {
            blockMap.set(key, {
              days: [],
              start: Number(b.start_hour),
              end: Number(b.end_hour),
              rawTime: b.raw_time,
            });
          }
          blockMap.get(key).days.push(b.day);
        });

        return {
          sec: sec.sec_number,
          instructor: sec.instructor,
          room: sec.room,
          building: sec.building,
          status: sec.status,
          blocks: Array.from(blockMap.values()),
        };
      }),
    }));

    return res.json(formatted);
  } catch (err) {
    console.error("Database query error:", err.message);
    return res
      .status(500)
      .json({ error: "فشل في استعلام المواد من قاعدة البيانات." });
  }
});

// 2. مسار مزامنة وحفظ مواد الجامعة مباشرة في Supabase
app.post("/api/sync-ptuk", async (req, res) => {
  const { cookie, viewState } = req.body;

  if (!cookie || !viewState) {
    return res
      .status(400)
      .json({ error: "مطلوب إرسال cookie و viewState في جسم الطلب." });
  }

  try {
    console.log("⏳ بدء سحب البيانات ومزامنتها مع Supabase...");
    const catalog = await scrapePTUKSchedules(cookie, viewState);

    let insertedCourses = 0;
    let insertedSections = 0;

    for (const item of catalog) {
      // إدخال المادة أو تحديثها (Upsert Course)
      const { error: courseErr } = await supabase
        .from("courses")
        .upsert(
          { code: item.code, name: item.name, type: item.type },
          { onConflict: "code" },
        );

      if (courseErr) {
        console.error(`خطأ في إدخال المساق ${item.code}:`, courseErr.message);
        continue;
      }
      insertedCourses++;

      for (const sec of item.sections) {
        // إدخال الشعبة أو تحديثها (Upsert Section)
        const { data: secData, error: secErr } = await supabase
          .from("sections")
          .upsert(
            {
              course_code: item.code,
              sec_number: sec.sec,
              instructor: sec.instructor,
              room: sec.room,
              building: sec.building,
              status: sec.status,
            },
            { onConflict: "course_code,sec_number" },
          )
          .select("id")
          .single();

        if (secErr || !secData) {
          console.error(
            `خطأ في إدخال الشعبة ${sec.sec} للمساق ${item.code}:`,
            secErr?.message,
          );
          continue;
        }
        insertedSections++;

        const sectionId = secData.id;

        // حذف الفترات القديمة وإعادة إدخالها لمنع التكرار
        await supabase
          .from("section_blocks")
          .delete()
          .eq("section_id", sectionId);

        const blocksToInsert = [];
        for (const block of sec.blocks) {
          for (const day of block.days) {
            blocksToInsert.push({
              section_id: sectionId,
              day,
              start_hour: block.start,
              end_hour: block.end,
              raw_time: block.rawTime,
            });
          }
        }

        if (blocksToInsert.length > 0) {
          await supabase.from("section_blocks").insert(blocksToInsert);
        }
      }
    }

    return res.json({
      success: true,
      coursesCount: insertedCourses,
      sectionsCount: insertedSections,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل بنجاح على: http://localhost:${PORT}`);
});
