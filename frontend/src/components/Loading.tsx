import { useState, useEffect, useMemo } from "react";

interface LoadingProps {
  selectedPlaceName: string;
}

const Loading = ({ selectedPlaceName }: LoadingProps) => {
  const placeName = selectedPlaceName.trim() || "the selected restaurant";

  // Initial messages (for first 20 seconds)
  const initialMessages = useMemo(
    () => [
      `Analyzing the best dishes at ${placeName}...`,
      `Scanning menus and foodie favorites...`,
      `Checking top-rated dishes loved by locals...`,
      `Comparing reviews to uncover hidden gems...`,
    ],
    [placeName]
  );

  // Delay messages (after 20 seconds)
  const delayMessages = useMemo(
    () => [
      `Still crunching the numbers... great dishes come to those who wait!`,
      `Analyzing more reviews to get the best results...`,
      `Fine-tuning recommendations just for you...`,
      `Almost ready! Just a little more patience...`,
    ],
    []
  );

  // State to track the current message
  const [loadingMessage, setLoadingMessage] = useState(initialMessages[0]);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    // Update the loading message every 5 seconds
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 5);

      // Choose the next message based on elapsed time
      setLoadingMessage((prev) => {
        const messages = elapsedTime >= 15 ? delayMessages : initialMessages;
        const nextIndex = (messages.indexOf(prev) + 1) % messages.length;
        return messages[nextIndex];
      });
    }, 5000);

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [elapsedTime, delayMessages, initialMessages]);

  return (
    <div className="loading-container">
      <div className="shimmer-text">{loadingMessage}</div>
      <div className="loader"></div>
    </div>
  );
};

export default Loading;
