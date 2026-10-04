import axios from "axios";

const cookie =
  "barcelona_expandeditems=menu-form%3Aj_idt68%2Cmenu-form%3Aj_idt79; JSESSIONID=24917d5795edfcaf9bc4814a7a78.inst3";
const viewState = "6959871929502973823:4644096584919082908";

async function triggerSync() {
  try {
    console.log("⏳ جاري إرسال طلب المزامنة إلى السيرفر...");
    const response = await axios.post("http://localhost:3001/api/sync-ptuk", {
      cookie,
      viewState,
    });
    console.log("✅ تم بنجاح:", response.data);
  } catch (error) {
    console.error("❌ فشل الطلب:", error.response?.data || error.message);
  }
}

triggerSync();
