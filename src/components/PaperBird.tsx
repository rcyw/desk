import { useState } from 'react';
import sprite from './paper-bird.png?url';
import './paper-bird.css';

export function PaperBird({ onFinish }: { onFinish: () => void }) {
  const [ready, setReady] = useState(false);

  return (
    <span
      className="desk-paper-bird"
      aria-hidden="true"
      hidden={!ready}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onFinish();
      }}
    >
      <img
        src={sprite}
        alt=""
        draggable={false}
        onLoad={() => setReady(true)}
        onError={onFinish}
      />
    </span>
  );
}
