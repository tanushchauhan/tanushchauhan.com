import { useEffect, useRef } from "react";

const sizeCanvas = (canvas) => {
  const { clientWidth, clientHeight } = canvas.parentElement;
  canvas.width = clientWidth;
  canvas.height = clientHeight;
  return { w: clientWidth, h: clientHeight };
};

/* falling glyphs, any key or click exits */
export const MatrixOverlay = ({ onExit }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const { w, h } = sizeCanvas(canvas);
    const g = canvas.getContext("2d");
    // spread, not indexed: 🤘 is two UTF-16 units and half of one draws as �
    const CHARS = [..."アカサタナハマヤラワ0123456789TANUSH🤘"];
    const col = 14;
    const drops = Array.from({ length: Math.ceil(w / col) }, () =>
      Math.floor(Math.random() * -40)
    );

    g.fillStyle = "#171717";
    g.fillRect(0, 0, w, h);

    const tick = setInterval(() => {
      g.fillStyle = "rgba(23, 23, 23, 0.12)";
      g.fillRect(0, 0, w, h);
      g.font = "13px monospace";
      drops.forEach((y, i) => {
        g.fillStyle = Math.random() > 0.975 ? "#d8ffe0" : "#22c55e";
        g.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * col, y * 16);
        drops[i] = y * 16 > h && Math.random() > 0.97 ? 0 : y + 1;
      });
    }, 50);

    let exited = false;
    const exit = () => {
      if (exited) return;
      exited = true;
      onExit(["matrix: wake up, Tanush… the portfolio has you."]);
    };
    // arm after the launching Enter keystroke has finished bubbling,
    // otherwise it exits the effect the instant it starts
    const arm = setTimeout(() => window.addEventListener("keydown", exit), 200);

    return () => {
      clearInterval(tick);
      clearTimeout(arm);
      window.removeEventListener("keydown", exit);
    };
  }, [onExit]);

  return <canvas ref={canvasRef} className="term-overlay" onClick={() => onExit([])} />;
};

/* arrow keys, eat 🦾, esc/q to quit */
export const SnakeOverlay = ({ onExit }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const { w, h } = sizeCanvas(canvas);
    const g = canvas.getContext("2d");
    const CELL = 18;
    const cols = Math.floor(w / CELL);
    const rows = Math.floor(h / CELL);

    let snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    let dir = { x: 1, y: 0 };
    let nextDir = dir;
    let food = null;
    let score = 0;

    const placeFood = () => {
      do {
        food = {
          x: Math.floor(Math.random() * cols),
          y: Math.floor(Math.random() * rows),
        };
      } while (snake.some((s) => s.x === food.x && s.y === food.y));
    };
    placeFood();

    const draw = () => {
      g.fillStyle = "#171717";
      g.fillRect(0, 0, w, h);
      g.font = `${CELL - 2}px monospace`;
      g.fillText("🦾", food.x * CELL, food.y * CELL + CELL - 3);
      snake.forEach((s, i) => {
        g.fillStyle = i === 0 ? "#ffb26b" : "#ff8a3d";
        g.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      g.fillStyle = "#a3a3a3";
      g.font = "12px monospace";
      g.fillText(`score ${score} · arrows to move, esc to quit`, 8, 16);
    };

    let over = false;
    const end = (died) => {
      if (over) return;
      over = true;
      onExit([
        died
          ? `snake: game over, score ${score}. The robots I work with have better pathfinding.`
          : `snake: quit, score ${score}`,
      ]);
    };

    const tick = setInterval(() => {
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows;
      const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
      if (hitWall || hitSelf) return end(true);

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 1;
        placeFood();
      } else {
        snake.pop();
      }
      draw();
    }, 110);

    const onKey = (e) => {
      const turns = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      if (turns[e.key]) {
        e.preventDefault();
        const t = turns[e.key];
        if (t.x !== -dir.x || t.y !== -dir.y) nextDir = t; // no 180s
        return;
      }
      if (e.key === "Escape" || e.key.toLowerCase() === "q") end(false);
    };
    window.addEventListener("keydown", onKey);
    draw();

    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onExit]);

  return <canvas ref={canvasRef} className="term-overlay" />;
};
