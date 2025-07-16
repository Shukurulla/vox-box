import React, { createContext, useState, useContext } from "react";

const InterviewContext = createContext();

export const InterviewProvider = ({ children }) => {
  const [currentText, setCurrentText] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [displayedAiResult, setDisplayedAiResult] = useState("");
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);

  return (
    <InterviewContext.Provider
      value={{
        currentText,
        setCurrentText,
        aiResult,
        setAiResult,
        displayedAiResult,
        setDisplayedAiResult,
        lastProcessedIndex,
        setLastProcessedIndex,
      }}
    >
      {children}
    </InterviewContext.Provider>
  );
};

export const useInterview = () => {
  const context = useContext(InterviewContext);
  if (context === undefined) {
    throw new Error("useInterview must be used within an InterviewProvider");
  }
  return context;
};
