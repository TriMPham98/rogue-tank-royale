// Settings Modal component
import React from "react";

interface SettingsModalProps {
  masterVolume: number;
  soundEffectsVolume: number;
  onMasterVolumeChange: (value: number) => void;
  onSoundEffectsVolumeChange: (value: number) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  masterVolume,
  soundEffectsVolume,
  onMasterVolumeChange,
  onSoundEffectsVolumeChange,
  onClose,
}) => {
  return (
    <div className="overlay settings-overlay">
      <div className="overlay-content settings-content">
        <h2 className="settings-title">SETTINGS</h2>
        <div className="settings-body">
          <div className="setting-group">
            <label className="setting-label">Master Volume</label>
            <div className="setting-control">
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseInt(e.target.value))}
                className="setting-slider"
              />
              <span className="setting-value">{masterVolume}%</span>
            </div>
          </div>
          <div className="setting-group">
            <label className="setting-label">Sound Effects</label>
            <div className="setting-control">
              <input
                type="range"
                min="0"
                max="100"
                value={soundEffectsVolume}
                onChange={(e) =>
                  onSoundEffectsVolumeChange(parseInt(e.target.value))
                }
                className="setting-slider"
              />
              <span className="setting-value">{soundEffectsVolume}%</span>
            </div>
          </div>
        </div>
        <div className="settings-buttons">
          <button className="settings-button secondary" onClick={onClose}>
            CLOSE
          </button>
          <button className="settings-button" onClick={onClose}>
            APPLY
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
