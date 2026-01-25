// Game Over Screen component
import React from "react";

interface GameOverScreenProps {
  score: number;
  rank: number;
  elapsedTime: number;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  rank,
  elapsedTime,
  onRestart,
}) => {
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  return (
    <div className="overlay game-over-overlay">
      <div className="overlay-content game-over-content">
        <h2 className="game-over-title">MISSION FAILED</h2>
        <p>Combat Score: {score}</p>
        <p>Highest Rank Achieved: {rank}</p>
        <p>
          Time Survived: {minutes}m {seconds}s
        </p>
        <button className="ui-button restart-button" onClick={onRestart}>
          RE-DEPLOY
        </button>
      </div>
    </div>
  );
};

export default GameOverScreen;
