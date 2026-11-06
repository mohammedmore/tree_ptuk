import assert from "node:assert/strict";
import { test } from "node:test";
import { ar } from "../src/i18n/locales/ar";
import { en } from "../src/i18n/locales/en";
import { useLanguageStore } from "../src/i18n";

test("i18n: Arabic and English dictionaries have matching key parity", () => {
  const sections = Object.keys(ar) as Array<keyof typeof ar>;

  sections.forEach((sec) => {
    assert.ok(en[sec], `Section ${sec} should exist in English dictionary`);
    const arKeys = Object.keys(ar[sec]);
    const enKeys = Object.keys(en[sec]);

    assert.deepEqual(
      arKeys.sort(),
      enKeys.sort(),
      `Keys in section ${sec} must match exactly between Arabic and English`,
    );
  });
});

test("i18n: useLanguageStore toggles language and updates active dictionary", () => {
  const store = useLanguageStore.getState();

  store.setLanguage("ar");
  assert.equal(useLanguageStore.getState().language, "ar");
  assert.equal(useLanguageStore.getState().t.nav.plan, "الخطة الدراسية");

  // Toggle to English
  store.toggleLanguage();
  assert.equal(useLanguageStore.getState().language, "en");
  assert.equal(useLanguageStore.getState().t.nav.plan, "Degree Plan");

  // Toggle back to Arabic
  store.toggleLanguage();
  assert.equal(useLanguageStore.getState().language, "ar");
  assert.equal(useLanguageStore.getState().t.nav.plan, "الخطة الدراسية");
});
