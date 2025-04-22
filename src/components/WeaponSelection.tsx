import React, { useEffect, useRef, useState, useCallback } from "react";
import { WeaponSelectionProps, SecondaryWeapon } from "../types";

const WeaponSelection: React.FC<WeaponSelectionProps> = ({
  onWeaponSelect,
  onClose,
  state,
}) => {
  const { availableWeapons, level, canSelect } = state;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSelectionLocked, setIsSelectionLocked] = useState(false);

  // Function to handle weapon selection and close the modal
  const handleWeaponSelect = useCallback(
    (weapon: SecondaryWeapon, event?: React.MouseEvent | KeyboardEvent) => {
      // Prevent multiple selections
      if (isSelectionLocked) {
        return;
      }

      // Lock selections immediately
      setIsSelectionLocked(true);

      // Stop event propagation if event exists
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }

      // Process selection
      onWeaponSelect(weapon);
      onClose();
    },
    [isSelectionLocked, onWeaponSelect, onClose]
  );

  // Add a manual close function for the cancel button
  const handleClose = useCallback(
    (event: React.MouseEvent) => {
      if (isSelectionLocked) {
        return;
      }

      setIsSelectionLocked(true);
      event.stopPropagation();
      event.preventDefault();
      onClose();
    },
    [isSelectionLocked, onClose]
  );

  // Reset the lock when the component unmounts or when canSelect changes
  useEffect(() => {
    setIsSelectionLocked(false); // Reset lock when modal opens/closes
    return () => {
      setIsSelectionLocked(false);
    };
  }, [canSelect]);

  // Handle keyboard number key selection
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!canSelect || isSelectionLocked) {
        return;
      }

      const keyNum = parseInt(event.key);
      if (!isNaN(keyNum) && keyNum > 0 && keyNum <= availableWeapons.length) {
        event.stopPropagation();
        event.preventDefault();
        event.stopImmediatePropagation(); // Crucial to stop other listeners

        const selectedWeapon = availableWeapons[keyNum - 1];
        handleWeaponSelect(selectedWeapon, event); // Pass the event
      }
    },
    [canSelect, isSelectionLocked, availableWeapons, handleWeaponSelect]
  );

  // Add keyboard event listener using capture phase
  useEffect(() => {
    if (canSelect) {
      window.addEventListener("keydown", handleKeyDown, true);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [canSelect, handleKeyDown]);

  if (!canSelect) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="weapon-selection-overlay"
      onClick={(e) => {
        e.stopPropagation();
      }}>
      <div
        className="weapon-selection-modal tactical-panel"
        onClick={(e) => {
          e.stopPropagation(); // Prevent clicks inside modal from propagating further
        }}>
        <div className="panel-header">
          <div className="header-decoration left"></div>
          <h2>TACTICAL ARMAMENT - RANK {level}</h2>
          <div className="header-decoration right"></div>
        </div>

        <div className="mission-directive">
          <div className="directive-icon"></div>
          <p>SELECT SECONDARY WEAPON SYSTEM FOR DEPLOYMENT</p>
        </div>

        <div className="weapon-grid">
          {availableWeapons.map((weapon, index) => (
            <div
              key={weapon.id}
              className="weapon-card"
              data-weapon-id={weapon.id}
              onClick={(e) => handleWeaponSelect(weapon, e)}
              role="button" // Add accessibility roles
              tabIndex={0} // Make focusable
              aria-label={`Select ${weapon.name} (Press ${index + 1})`} // ARIA label
              onKeyDown={(e) => {
                // Allow selection with Enter/Space when focused
                if (e.key === "Enter" || e.key === " ") {
                  handleWeaponSelect(weapon);
                }
              }}>
              <div className="designation-tag">
                <div className="designation-marker">MK-{index + 1}</div>
                <div className="selection-indicator">{index + 1}</div>
              </div>

              <h3 className="weapon-designation">{weapon.name}</h3>

              <div className="specs-container">
                <p className="weapon-description">{weapon.description}</p>

                <div className="specs-separator">
                  <div className="separator-text">SPECIFICATIONS</div>
                  <div className="separator-line"></div>
                </div>

                <div className="weapon-stats">
                  <div className="stat">
                    <span className="stat-label">DMG RATING:</span>
                    <span className="stat-value">{weapon.damage}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">CYCLE TIME:</span>
                    <span className="stat-value">{weapon.cooldown}s</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">EFFECTIVE RANGE:</span>
                    <span className="stat-value">{weapon.range}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="action-panel">
          <button className="action-button close-button" onClick={handleClose}>
            <span className="button-icon">✕</span>
            <span className="button-text">DISMISS SELECTION</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeaponSelection;
