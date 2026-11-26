import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { AppRoute } from "../router";
import {
  FEATURE_TOUR_PAGE_TITLES,
  FEATURE_TOUR_STEPS,
  type FeatureTourStep,
} from "../core/featureTour";

const STORAGE_KEY = "ptuk_feature_tour_v1";

interface FeatureTourGuideProps {
  route: AppRoute;
  openRequest: number;
}

interface PopoverPosition {
  top: number;
  left: number;
}

function getPopoverPosition(
  target: HTMLElement,
  popover: HTMLElement | null,
): PopoverPosition {
  const rect = target.getBoundingClientRect();
  const margin = 12;
  const gap = 10;
  const width = Math.min(340, window.innerWidth - margin * 2);
  const height =
    popover?.getBoundingClientRect().height ??
    Math.min(360, window.innerHeight * 0.7);
  const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
  const spaceAbove = rect.top - margin - gap;
  const placeBelow = spaceBelow >= height || spaceBelow >= spaceAbove;
  const desiredTop = placeBelow ? rect.bottom + gap : rect.top - height - gap;

  return {
    top: Math.max(
      margin,
      Math.min(desiredTop, window.innerHeight - height - margin),
    ),
    left: Math.max(
      margin,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - margin,
      ),
    ),
  };
}

function readCompletedSteps(): Set<string> {
  try {
    const savedValue: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || "[]",
    );
    if (!Array.isArray(savedValue)) return new Set();
    return new Set(
      savedValue.filter((value): value is string => typeof value === "string"),
    );
  } catch (error) {
    console.warn("Could not read feature guide progress:", error);
    return new Set();
  }
}

function getTarget(featureId: string): HTMLElement | null {
  const targets = document.querySelectorAll<HTMLElement>(
    `[data-feature-tour~="${featureId}"]`,
  );
  return (
    Array.from(targets).find((target) => target.getClientRects().length > 0) ??
    null
  );
}

function getVisibleTarget(featureId: string): HTMLElement | null {
  const targets = document.querySelectorAll<HTMLElement>(
    `[data-feature-tour~="${featureId}"]`,
  );

  return (
    Array.from(targets).find((target) => {
      if (!target.getClientRects().length) return false;

      const rect = target.getBoundingClientRect();
      const visibleBounds = {
        top: Math.max(0, rect.top),
        right: Math.min(window.innerWidth, rect.right),
        bottom: Math.min(window.innerHeight, rect.bottom),
        left: Math.max(0, rect.left),
      };

      for (
        let ancestor = target.parentElement;
        ancestor && ancestor !== document.documentElement;
        ancestor = ancestor.parentElement
      ) {
        const style = window.getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        if (style.overflowY !== "visible") {
          visibleBounds.top = Math.max(visibleBounds.top, ancestorRect.top);
          visibleBounds.bottom = Math.min(
            visibleBounds.bottom,
            ancestorRect.bottom,
          );
        }
        if (style.overflowX !== "visible") {
          visibleBounds.left = Math.max(visibleBounds.left, ancestorRect.left);
          visibleBounds.right = Math.min(
            visibleBounds.right,
            ancestorRect.right,
          );
        }
      }

      return (
        visibleBounds.bottom > visibleBounds.top &&
        visibleBounds.right > visibleBounds.left
      );
    }) ?? null
  );
}

function findNextStepIndex(
  steps: FeatureTourStep[],
  startIndex: number,
  completed: Set<string>,
): number {
  for (let index = startIndex; index < steps.length; index += 1) {
    if (!completed.has(steps[index].id)) return index;
  }
  return -1;
}

function scrollToStep(step: FeatureTourStep): void {
  window.requestAnimationFrame(() => {
    getTarget(step.id)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
}

export default function FeatureTourGuide({
  route,
  openRequest,
}: FeatureTourGuideProps): React.ReactElement | null {
  const page = route === "calendar" ? "plan" : route;
  const steps = useMemo(() => FEATURE_TOUR_STEPS[page] ?? [], [page]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLElement | null>(null);
  const completedRef = useRef(completedIds);
  const activeStep = steps[activeIndex];
  const pageTitle = FEATURE_TOUR_PAGE_TITLES[page] ?? "هذه الصفحة";
  const completedCount = steps.filter((step) =>
    completedIds.has(step.id),
  ).length;

  const persistCompleted = useCallback((completed: Set<string>) => {
    completedRef.current = completed;
    setCompletedIds(completed);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
    } catch (error) {
      console.warn("Could not save feature guide progress:", error);
    }
  }, []);

  const openGuide = useCallback(() => {
    const nextIndex = findNextStepIndex(steps, 0, completedRef.current);
    const index = nextIndex === -1 ? 0 : nextIndex;
    setActiveIndex(index);
    setIsChecklistOpen(false);
    setIsOpen(steps.length > 0);
    if (steps[index]) scrollToStep(steps[index]);
  }, [steps]);

  useEffect(() => {
    const completed = readCompletedSteps();
    completedRef.current = completed;
    setCompletedIds(completed);
    const nextIndex = findNextStepIndex(steps, 0, completed);
    setActiveIndex(nextIndex);
    setIsOpen(nextIndex !== -1);
    setIsChecklistOpen(false);
    if (nextIndex !== -1) scrollToStep(steps[nextIndex]);
  }, [page, steps]);

  useEffect(() => {
    if (openRequest > 0) openGuide();
  }, [openGuide, openRequest]);

  const goToStep = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;
      setActiveIndex(index);
      setIsOpen(true);
      setIsChecklistOpen(false);
      scrollToStep(step);
    },
    [steps],
  );

  const completeAndAdvance = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;

      const completed = new Set(completedRef.current);
      completed.add(step.id);
      persistCompleted(completed);
      const nextIncompleteIndex = findNextStepIndex(
        steps,
        index + 1,
        completed,
      );
      const nextIndex =
        nextIncompleteIndex === -1 && index + 1 < steps.length
          ? index + 1
          : nextIncompleteIndex;
      if (nextIndex === -1) {
        setIsOpen(false);
        setPosition(null);
        return;
      }

      setActiveIndex(nextIndex);
      setIsChecklistOpen(false);
      const nextStep = steps[nextIndex];
      scrollToStep(nextStep);
    },
    [persistCompleted, steps],
  );

  const dismissGuide = useCallback(() => {
    setIsOpen(false);
    setPosition(null);
    setIsChecklistOpen(false);
  }, []);

  const skipPageGuide = useCallback(() => {
    const completed = new Set(completedRef.current);
    steps.forEach((step) => completed.add(step.id));
    persistCompleted(completed);
    dismissGuide();
  }, [dismissGuide, persistCompleted, steps]);

  useEffect(() => {
    if (!isOpen || !activeStep) {
      targetRef.current?.classList.remove("feature-tour-target-active");
      targetRef.current = null;
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const target = getVisibleTarget(activeStep.id);
      if (!target) {
        setPosition(null);
        return;
      }

      if (targetRef.current !== target) {
        targetRef.current?.classList.remove("feature-tour-target-active");
        target.classList.add("feature-tour-target-active");
        targetRef.current = target;
      }

      const nextPosition = getPopoverPosition(target, popoverRef.current);
      setPosition((current) =>
        current?.top === nextPosition.top && current.left === nextPosition.left
          ? current
          : nextPosition,
      );
    };

    updatePosition();
    const positionFrame = window.requestAnimationFrame(updatePosition);
    const mutationObserver = new MutationObserver(updatePosition);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const handleScroll = () => {
      updatePosition();
      const currentTarget = targetRef.current;
      if (!currentTarget || currentTarget.getBoundingClientRect().bottom > 72) {
        return;
      }

      const step = steps[activeIndex];
      if (!step) return;
      const completed = new Set(completedRef.current);
      completed.add(step.id);
      const nextIndex = findNextStepIndex(steps, activeIndex + 1, completed);
      if (nextIndex !== -1 && !getVisibleTarget(steps[nextIndex].id)) {
        return;
      }

      persistCompleted(completed);
      setActiveIndex(nextIndex);
      if (nextIndex === -1) {
        setIsOpen(false);
        setPosition(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissGuide();
    };

    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updatePosition);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      mutationObserver.disconnect();
      window.cancelAnimationFrame(positionFrame);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("keydown", handleKeyDown);
      targetRef.current?.classList.remove("feature-tour-target-active");
      targetRef.current = null;
    };
  }, [activeIndex, activeStep, dismissGuide, isOpen, persistCompleted, steps]);

  if (!isOpen && steps.length > 0) {
    return (
      <button
        type="button"
        onClick={openGuide}
        className="feature-guide-reopen"
        aria-label={`فتح دليل ميزات صفحة ${pageTitle}`}
        title={`دليل ميزات صفحة ${pageTitle}`}
      >
        دليل الصفحة
      </button>
    );
  }
  if (!isOpen || !activeStep || !position) return null;

  return createPortal(
    <aside
      ref={popoverRef}
      className="feature-guide-popover"
      role="status"
      aria-live="polite"
      dir="rtl"
      style={{ top: position.top, left: position.left }}
      aria-label={`شرح ميزة: ${activeStep.title}`}
    >
      <header className="feature-guide-header">
        <div>
          <span className="feature-guide-page">{pageTitle}</span>
          <span className="feature-guide-count">
            {activeIndex + 1} من {steps.length} ميزات
          </span>
        </div>
        <button
          type="button"
          onClick={dismissGuide}
          aria-label="إغلاق دليل الميزات مؤقتاً"
          className="feature-guide-close"
        >
          ×
        </button>
      </header>

      <h2 className="feature-guide-title">{activeStep.title}</h2>
      <p className="feature-guide-description">{activeStep.description}</p>

      <details
        className="feature-guide-checklist"
        open={isChecklistOpen}
        onToggle={(event) => setIsChecklistOpen(event.currentTarget.open)}
      >
        <summary>
          قائمة الميزات ({completedCount}/{steps.length})
        </summary>
        <ul>
          {steps.map((step, index) => {
            const isCompleted = completedIds.has(step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  aria-current={index === activeIndex ? "step" : undefined}
                  className={isCompleted ? "is-complete" : undefined}
                >
                  <span aria-hidden="true">{isCompleted ? "✓" : "○"}</span>
                  {step.title}
                </button>
              </li>
            );
          })}
        </ul>
      </details>

      <footer className="feature-guide-actions">
        <button type="button" onClick={dismissGuide}>
          لاحقاً
        </button>
        <button type="button" onClick={skipPageGuide}>
          تخطي بقية الصفحة
        </button>
        <button
          type="button"
          onClick={() => goToStep(activeIndex - 1)}
          disabled={activeIndex <= 0}
          aria-label="العودة إلى الشرح السابق"
        >
          رجوع
        </button>
        <button
          type="button"
          onClick={() => completeAndAdvance(activeIndex)}
          className="feature-guide-next"
        >
          {activeIndex === steps.length - 1 ? "تم" : "فهمت، التالي"}
        </button>
      </footer>
    </aside>,
    document.body,
  );
}
