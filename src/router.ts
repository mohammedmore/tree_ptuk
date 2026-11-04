import { useState, useEffect } from "react";

export type AppRoute =
  | "plan"
  | "courses"
  | "schedule"
  | "gpa"
  | "semester-planning"
  | "registration"
  | "calendar"
  | "login";

function parseHash(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, "").split("?")[0].trim();
  switch (clean) {
    case "courses":
      return "courses";
    case "schedule":
      return "schedule";
    case "gpa":
      return "gpa";
    case "semester-planning":
      return "semester-planning";
    case "registration":
      return "registration";
    case "calendar":
      return "calendar";
    case "login":
      return "login";
    case "plan":
    default:
      return "plan";
  }
}

export function navigateTo(route: AppRoute): void {
  if (typeof window !== "undefined") {
    window.location.hash = `#/${route}`;
  }
}

export function useAppRoute(): [AppRoute, (route: AppRoute) => void] {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    if (typeof window !== "undefined") {
      return parseHash(window.location.hash);
    }
    return "plan";
  });

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(parseHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return [currentRoute, navigateTo];
}
