import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface TimerProps {
  isRunning: boolean;
  className?: string;
}

const Timer: React.FC<TimerProps> = ({ isRunning, className = "" }) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      setTime(0);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  return <span className={className}>{formatTime(time)}</span>;
};

export default Timer;
