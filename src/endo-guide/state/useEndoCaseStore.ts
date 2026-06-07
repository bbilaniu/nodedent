import { useState } from "react";
import type { EndoCase } from "../types";
import { getSavedCurrentNodeId } from "../engine/getCurrentNode";
import { initialCase, STORAGE_KEY } from "./persistence";

export function useEndoCaseStore() {
  const [caseData, setCaseData] = useState<EndoCase>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? { ...initialCase, ...JSON.parse(saved) } : initialCase;
    } catch {
      return initialCase;
    }
  });
  const [currentNodeId, setCurrentNodeId] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? getSavedCurrentNodeId(JSON.parse(saved)) : "preop";
    } catch {
      return "preop";
    }
  });

  return {
    caseData,
    setCaseData,
    currentNodeId,
    setCurrentNodeId,
  };
}
