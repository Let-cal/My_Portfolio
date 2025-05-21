import PropTypes from "prop-types";
import { useCallback, useEffect, useRef, useState } from "react";

const WhyCard = ({ skill }) => {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    window.requestAnimationFrame(() => {
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setTilt({ x, y });
    });
  }, []);

  // Reset on mouse leave
  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onEnter = () => setIsHovered(true);

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    card.addEventListener("mouseenter", onEnter);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
      card.removeEventListener("mouseenter", onEnter);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const xDeg = (tilt.y - 0.5) * 8;
  const yDeg = (tilt.x - 0.5) * -8;

  const WaveSvgBackground = ({ colors }) => (
    <svg
      className="wave-svg w-full h-full transition-transform duration-1000 ease-out"
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      style={{
        transform: isHovered
          ? `translate(${(tilt.x - 0.5) * -20}px, ${
              (tilt.y - 0.5) * -20
            }px) scale(1.05)`
          : "scale(1)",
        transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <defs>
        <linearGradient
          id={`skillGradient-${skill.id}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
        <linearGradient
          id={`waveGradient1-${skill.id}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="50%" stopColor={colors[1]} />
          <stop offset="100%" stopColor={colors[0]} />
        </linearGradient>
        <linearGradient
          id={`waveGradient2-${skill.id}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor={colors[1]} />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#skillGradient-${skill.id})`}
      />
      <path
        d="M0,230 C30,220 60,240 90,230 C120,220 150,240 180,230 C210,220 240,240 270,230 C290,225 295,230 300,225 L300,400 L0,400 Z"
        fill={`url(#waveGradient1-${skill.id})`}
        opacity="0.8"
        style={{
          transform: isHovered
            ? `translate(${(tilt.x - 0.5) * -10}px, ${(tilt.y - 0.5) * -6}px)`
            : "",
          transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      <path
        d="M0,260 C40,250 80,270 120,260 C160,250 200,270 240,260 C280,250 290,260 300,255 L300,400 L0,400 Z"
        fill={`url(#waveGradient2-${skill.id})`}
        opacity="0.9"
        style={{
          transform: isHovered
            ? `translate(${(tilt.x - 0.5) * -15}px, ${(tilt.y - 0.5) * -9}px)`
            : "",
          transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      <path
        d="M0,290 C50,280 100,300 150,290 C200,280 250,300 300,290 L300,400 L0,400 Z"
        fill="#FFFFFF"
        opacity="0.9"
        style={{
          transform: isHovered
            ? `translate(${(tilt.x - 0.5) * -20}px, ${(tilt.y - 0.5) * -12}px)`
            : "",
          transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </svg>
  );

  WaveSvgBackground.propTypes = {
    colors: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  const GridBackground = () => (
    <div className="card-layer card-background absolute top-0 left-0 w-full h-full bg-white">
      <div className="bg-grid absolute top-0 left-0 w-full h-full">
        {[25, 50, 75].map((top, i) => (
          <div
            key={`h-${i}`}
            className="grid-line horizontal absolute w-full h-px bg-black bg-opacity-10"
            style={{
              top: `${top}%`,
              transform: `scaleX(${isHovered ? 1 : 0.3})`,
              transformOrigin: "left",
              transition: `transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${
                0.1 + i * 0.1
              }s`,
            }}
          />
        ))}
        {[33.33, 66.66].map((left, i) => (
          <div
            key={`v-${i}`}
            className="grid-line vertical absolute h-full w-px bg-black bg-opacity-10"
            style={{
              left: `${left}%`,
              transform: `scaleY(${isHovered ? 1 : 0.3})`,
              transformOrigin: "top",
              transition: `transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${
                0.15 + i * 0.1
              }s`,
            }}
          />
        ))}
      </div>
      <div className="bg-objects absolute top-0 left-0 w-full h-full pointer-events-none">
        <div
          className="bg-object circle absolute w-24 h-24 rounded-full border border-black border-opacity-10"
          style={{
            bottom: "40px",
            left: "-30px",
            transform: isHovered
              ? `translate(${(tilt.x - 0.5) * 10}px, ${(tilt.y - 0.5) * 8}px)`
              : "translateY(20px)",
            opacity: isHovered ? 1 : 0.3,
            transition:
              "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <div
          className="bg-object square absolute w-16 h-16 border border-black border-opacity-10"
          style={{
            top: "40px",
            right: "30px",
            transform: isHovered
              ? `rotate(45deg) translate(${(tilt.x - 0.5) * 10}px, ${
                  (tilt.y - 0.5) * 8
                }px)`
              : "rotate(45deg) translateY(-20px)",
            opacity: isHovered ? 1 : 0.3,
            transition:
              "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        <div
          className="bg-object triangle absolute w-0 h-0"
          style={{
            top: "50%",
            left: "50%",
            borderLeft: "40px solid transparent",
            borderRight: "40px solid transparent",
            borderBottom: "70px solid rgba(0, 0, 0, 0.05)",
            transform: isHovered
              ? `translate(-50%, -50%) scale(1) rotate(${
                  (tilt.x - 0.5) * 20
                }deg)`
              : "translate(-50%, -50%) scale(0.5)",
            opacity: isHovered ? 1 : 0.3,
            transition:
              "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
    </div>
  );

  const isHardSkill = skill.category === "hard";
  const getLayerStyle = (index) => {
    if (!isHovered) return {};
    const depth = 30 * (index + 1);
    const offsetX = (tilt.x - 0.5) * 10 * (index + 1);
    const offsetY = (tilt.y - 0.5) * 10 * (index + 1);
    return {
      transform: `translate3d(${offsetX}px, ${offsetY}px, ${depth}px)`,
    };
  };

  const textColorClass = isHardSkill ? "text-black" : "text-black";
  const metaLineColorClass = isHardSkill ? "bg-black" : "bg-black";
  const textShadowClass = isHardSkill ? "text-shadow" : "";

  return (
    <article
      ref={cardRef}
      className="deconstructed-card relative w-[300px] h-[400px] cursor-pointer transition-transform duration-600 ease-out transform-gpu"
      style={{
        transformStyle: "preserve-3d",
        perspective: "1200px",
        transform: isHovered
          ? `perspective(1200px) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`
          : "",
      }}
    >
      <div
        className="card-layer card-image absolute top-0 left-0 w-full h-full overflow-hidden z-10"
        style={getLayerStyle(0)}
      >
        {isHardSkill ? (
          <WaveSvgBackground
            colors={skill.gradientColors || ["#118AB2", "#5AC8E3"]}
          />
        ) : (
          <GridBackground />
        )}
      </div>
      <div
        className="card-layer card-frame absolute top-0 left-0 w-full h-full z-30 pointer-events-none"
        style={getLayerStyle(1)}
      >
        {/* Frame */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <svg
            viewBox="0 0 300 400"
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <path
              d="M 20,20 H 280 V 380 H 20 Z"
              fill="none"
              stroke="rgba(0,0,0,0.8)"
              strokeWidth="1"
              style={{
                strokeDasharray: 1520,
                strokeDashoffset: isHovered ? 0 : 1520,
                transition: "stroke-dashoffset 1.2s ease",
              }}
            />
          </svg>
        </div>
      </div>
      <div
        className={`card-layer card-content absolute top-0 left-0 w-full h-full p-8 flex flex-col justify-between z-20 ${textColorClass}`}
        style={getLayerStyle(2)}
      >
        <div className="content-fragment fragment-heading mt-auto mb-6">
          <h2
            className={`content-text text-2xl font-black leading-tight tracking-tight ${textColorClass} ${textShadowClass}`}
            style={{
              transform: isHovered ? "translateY(0)" : "translateY(10px)",
              opacity: isHovered ? 1 : 0.7,
              transition:
                "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: "0.1s",
            }}
          >
            {skill.title}
          </h2>
          <h3
            className={`content-subtext text-sm font-medium tracking-wider mt-4 ${textColorClass} opacity-50`}
            style={{
              transform: isHovered ? "translateY(0)" : "translateY(10px)",
              opacity: isHovered ? 1 : 0.5,
              transition:
                "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: "0.15s",
            }}
          >
            {skill.subtitle}
          </h3>
        </div>
        <div className="content-fragment fragment-meta flex items-center gap-2 mb-8">
          <div
            className={`meta-line w-10 h-px ${metaLineColorClass}`}
            style={{
              transform: `scaleX(${isHovered ? 1 : 0.5})`,
              transformOrigin: "left",
              transition: "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: "0.05s",
            }}
          />
          <span
            className={`meta-text font-mono text-xs tracking-wider opacity-60 ${textColorClass}`}
            style={{
              transform: isHovered ? "translateX(0)" : "translateX(-5px)",
              opacity: isHovered ? 1 : 0.6,
              transition:
                "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: "0.15s",
            }}
          >
            {skill.type.toUpperCase()}
          </span>
        </div>
        <div className="content-fragment fragment-body max-w-[85%] my-6">
          <p
            className={`content-text text-sm leading-relaxed ${textColorClass}`}
            style={{
              opacity: isHovered ? 1 : 0.6,
              transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              transitionDelay: "0.1s",
            }}
          >
            {skill.description}
          </p>
        </div>
      </div>
    </article>
  );
};

WhyCard.propTypes = {
  skill: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    category: PropTypes.string.isRequired,
    gradientColors: PropTypes.arrayOf(PropTypes.string),
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
  }).isRequired,
};

export default WhyCard;
