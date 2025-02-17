interface SubmitButtonProps {
  selectedPlaceName: string;
  selectedPlaceId: string;
  onGetBestDishes: (name: string, url: string) => void;
}

const SubmitButton = ({
  selectedPlaceName = "",
  selectedPlaceId = "",
  onGetBestDishes,
}: SubmitButtonProps) => {
  const buttonText = selectedPlaceName
    ? `Discover the best dishes at ${selectedPlaceName}`
    : "Discover the best dishes!";

  const isButtonDisabled = !selectedPlaceName || !selectedPlaceId;

  return (
    <div className="button-container">
      <button
        className="submit-button"
        onClick={() => onGetBestDishes(selectedPlaceName, selectedPlaceId)}
        disabled={isButtonDisabled}
      >
        {buttonText}
      </button>
    </div>
  );
};

export default SubmitButton;
