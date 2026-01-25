// Confirm Dialog component
import React from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="overlay confirm-dialog-overlay">
      <div className="overlay-content confirm-dialog-content">
        <h2 className="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="confirm-buttons">
          <button className="ui-button yes-button" onClick={onConfirm}>
            Yes
          </button>
          <button className="ui-button no-button" onClick={onCancel}>
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
