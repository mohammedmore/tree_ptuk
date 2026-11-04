/**
 * PTUK Edugate DOM Selectors
 *
 * NOTE: As per the PTUK Registration API guidelines, selectors must be grounded in captured evidence.
 * JSF/PrimeFaces generates dynamic IDs (e.g., j_idtXX). We isolate and annotate them here.
 */

export const SELECTORS = {
  // Login Page selectors (Derived from authService.js & live Edugate portal inspection)
  LOGIN: {
    usernameInput:
      'input[type="text"]:visible, input[name*="user"], input[name*="j_idt17"]',
    passwordInput: 'input[type="password"]:visible, input[name*="j_idt21"]',
    submitButton:
      'button[type="submit"]:visible, input[type="submit"]:visible, .ui-button:visible',
    errorMessage:
      ".ui-growl-message, .ui-messages-error, .alert-danger, .error",
    viewState: 'input[name="javax.faces.ViewState"]',
  },

  // Registration Page URLs
  URLS: {
    onlineRegistration:
      "https://edugate.ptuk.edu.ps/student/onlineRegistration",
    onlineRegistrationFaces:
      "https://edugate.ptuk.edu.ps/faces/ui/pages/student/onlineRegistration/index.xhtml",
    studentScheduleCourses:
      "https://edugate.ptuk.edu.ps/faces/ui/pages/student/scheduleCourses/index.xhtml",
  },

  // Online Registration Status & Notice elements
  NOTICES: {
    growl: ".ui-growl-message",
    messages: ".ui-messages-info, .ui-messages-error, .ui-messages-warn",
    pageBody: "body",
  },

  // Candidate Registration Table & Action Elements (Verified vs Unverified)
  REGISTRATION_FORM: {
    // Unverified: Awaiting captured evidence during open registration window
    candidateCourseInput: 'input[id*="course"], input[name*="course"]',
    candidateSectionInput:
      'input[id*="sec"], input[name*="sec"], select[id*="sec"]',
    candidateAddButton:
      'button:has-text("إضافة"), input[value*="إضافة"], .ui-button:has-text("إضافة")',
    candidateSubmitButton:
      'button:has-text("تثبيت"), button:has-text("تأكيد"), input[value*="تثبيت"]',
    registeredCoursesTable:
      '#contents\\:registeredCourses_data, table[id*="registered"] tbody tr',
  },
};
