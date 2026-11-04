/**
 * Data Access Layer for Courses & Sections
 */
export function createCoursesDal(getState, supabaseClient) {
  return {
    async getCourses(filter = {}) {
      const { codes, search, limit = 500, offset = 0, fields } = filter;
      const state = getState();

      if (supabaseClient) {
        try {
          const selectFields =
            fields && Array.isArray(fields) && fields.length > 0
              ? fields.join(",")
              : `code, name, type, sections ( id, sec_number, instructor, room, building, status, section_blocks ( day, start_hour, end_hour, raw_time ) )`;

          let query = supabaseClient.from("courses").select(selectFields);
          if (codes && codes.length > 0) {
            query = query.in("code", codes);
          }
          const { data, error } = await query;
          if (!error && Array.isArray(data) && data.length > 0) {
            return data;
          }
        } catch (err) {
          console.warn("⚠️ Supabase DAL query fallback:", err.message);
        }
      }

      let list = Object.values(state.courses);
      if (codes && codes.length > 0) {
        const codeSet = new Set(codes.map((c) => String(c).trim()));
        list = list.filter((c) => codeSet.has(c.code));
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            (c.name && c.name.toLowerCase().includes(q)),
        );
      }
      return list.slice(offset, offset + limit);
    },

    async getCourseByCode(code) {
      const state = getState();
      const norm = String(code).trim();
      if (state.courses[norm]) return state.courses[norm];
      const res = await this.getCourses({ codes: [norm] });
      return res[0] || null;
    },
  };
}
