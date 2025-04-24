import { useState, useEffect } from "react";

interface LoadingProps {
  selectedPlaceName: string;
}

const Loading = ({ selectedPlaceName }: LoadingProps) => {
  const placeName = selectedPlaceName.trim() || "the selected restaurant";
  const [loadingMessage, setLoadingMessage] = useState("");
  // const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let elapsedTime = 0;
    setLoadingMessage(`Analyzing the best dishes at ${placeName}...`);

    const interval = setInterval(() => {
      elapsedTime += 5;
      const initialMessages = [
        `Analyzing the best dishes at ${placeName}...`,
        `Scanning menus and foodie favorites...`,
        `Checking top-rated dishes loved by locals...`,
        `Comparing reviews to uncover hidden gems...`,
      ];

      const delayMessages = [
        `Still crunching the numbers... great dishes come to those who wait!`,
        `Analyzing more reviews to get the best results...`,
        `Fine-tuning recommendations just for you...`,
        `Almost ready! Just a little more patience...`,
      ];

      // Calculate message index based solely on time
      const messageSet = elapsedTime < 20 ? initialMessages : delayMessages;
      const messageIndex = Math.floor((elapsedTime / 5) % messageSet.length);

      setLoadingMessage(messageSet[messageIndex]);
    }, 5000);

    return () => clearInterval(interval);
  }, [placeName]);

  /*
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 5);

      const initialMessages = [
        `Analyzing the best dishes at ${placeName}...`,
        `Scanning menus and foodie favorites...`,
        `Checking top-rated dishes loved by locals...`,
        `Comparing reviews to uncover hidden gems...`,
      ];

      const delayMessages = [
        `Still crunching the numbers... great dishes come to those who wait!`,
        `Analyzing more reviews to get the best results...`,
        `Fine-tuning recommendations just for you...`,
        `Almost ready! Just a little more patience...`,
      ];

      const messages = elapsedTime >= 15 ? delayMessages : initialMessages;
      const currentIndex = messages.indexOf(loadingMessage);
      const nextIndex =
        currentIndex === -1 ? 0 : (currentIndex + 1) % messages.length;
      setLoadingMessage(messages[nextIndex]);
    }, 5000);

    return () => clearInterval(interval);
  }, [loadingMessage, elapsedTime, placeName]);
  */

  return (
    <div className="loading-container">
      <div className="shimmer-text">{loadingMessage}</div>
      <div className="loader" data-testid="loader"></div>
    </div>
  );
};

export default Loading;
