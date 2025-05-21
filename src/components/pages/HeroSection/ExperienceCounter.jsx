import { motion, useAnimation } from "framer-motion";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

// Helper function to wrap text in spans
const wrapTextInSpans = (text) => {
  return text.split("").map((char, index) => (
    <span key={index} className="inline-block">
      {char === " " ? "\u00A0" : char}
    </span>
  ));
};

// eslint-disable-next-line react/prop-types
const ExperienceCounter = ({ years = 3 }) => {
  const [count, setCount] = useState(0);
  const controls = useAnimation();
  const counterRef = useRef(null);
  const timelineRef = useRef(null);

  // Ring animation
  const [ringRotation, setRingRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRingRotation((prev) => (prev + 1) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Counter animation
  useEffect(() => {
    if (count < years) {
      const timer = setTimeout(() => {
        setCount((prev) => prev + 1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [count, years]);

  // Pulse animation for the icon
  useEffect(() => {
    controls.start({
      scale: [1, 1.05, 1],
      opacity: [0.8, 1, 0.8],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse",
      },
    });
  }, [controls]);

  // GSAP explode-and-gather animation
  useEffect(() => {
    if (counterRef.current) {
      // Get all letter spans regardless of whether counter has finished
      const letters = counterRef.current.querySelectorAll(
        ".counter-text span, .label-text span"
      );

      // Clear any existing animations first
      if (timelineRef.current) {
        timelineRef.current.kill();
      }

      // Set initial random positions - EXACT same settings as LogoTitle
      gsap.set(letters, {
        x: () => gsap.utils.random(-500, 500),
        y: () => gsap.utils.random(-500, 500),
        rotation: () => gsap.utils.random(-720, 720),
        scale: 0,
        opacity: 0,
      });

      // Create timeline with EXACT same settings as LogoTitle and original
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.65,
        yoyo: true,
      });

      // Add animation to timeline - EXACT same params as LogoTitle
      tl.to(letters, {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        rotation: 0,
        ease: "power4.inOut",
        stagger: 0.0125,
        duration: 0.75,
      });

      // Store timeline in ref
      timelineRef.current = tl;

      // Cleanup
      return () => {
        tl.kill();
      };
    }
  }, [count]); // Run this effect whenever count changes to keep the animation fresh

  // Mouse event handlers - EXACT same as LogoTitle
  const handleMouseEnter = () => {
    if (timelineRef.current) {
      timelineRef.current.timeScale(0.15);
    }
  };

  const handleMouseLeave = () => {
    if (timelineRef.current) {
      timelineRef.current.timeScale(1);
    }
  };

  return (
    <motion.div
      className="flex flex-col items-center relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      ref={counterRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Animated circular background */}
      <motion.div
        className="absolute w-[180px] h-[180px] md:w-[200px] md:h-[200px] rounded-full"
        style={{
          background: `conic-gradient(from ${ringRotation}deg, rgba(251, 146, 60, 0.05), rgba(251, 146, 60, 0.2), rgba(251, 146, 60, 0.05))`,
        }}
      />

      {/* Inner circle */}
      <motion.div
        className="absolute w-[150px] h-[150px] md:w-[170px] md:h-[170px] rounded-full bg-white/50"
        style={{ backdropFilter: "blur(8px)" }}
      />

      {/* Experience icon with enhanced animation */}
      <motion.div className="relative mb-4 z-10" animate={controls}>
        <motion.img
          src="https://cdn.builder.io/api/v1/image/assets/TEMP/afed4b7ae19836d293ba524f52f4bc281548d12a0ee458f86138c5293c311d41?apiKey=cd005ddf4701497994e353eeb1b48178&"
          alt="Experience Icon"
          className="w-[100px] h-[100px] md:w-[120px] md:h-[120px]"
          whileHover={{
            rotate: 360,
            transition: { duration: 1.5, ease: "easeInOut" },
          }}
        />

        {/* Subtle glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full blur-md"
          style={{
            background:
              "radial-gradient(circle, rgba(251, 146, 60, 0.3) 0%, transparent 70%)",
            zIndex: -1,
          }}
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
      </motion.div>

      {/* Counter with improved animation - Now inside a container with a class for GSAP to target */}
      <motion.div
        className="flex gap-3 text-5xl font-bold tracking-tighter md:text-6xl relative z-10 counter-text"
        key={count}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {wrapTextInSpans(count.toString())}
        <motion.span
          className="years-text"
          animate={{
            color: ["#FB923C", "#F97316", "#FB923C"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        >
          {wrapTextInSpans("Years")}
        </motion.span>
      </motion.div>

      <motion.div
        className="text-xl tracking-tight md:text-2xl relative z-10 label-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {wrapTextInSpans("Experience")}
      </motion.div>

      {/* Small floating particles */}
      <FloatingParticles />
    </motion.div>
  );
};

// Add floating particles for visual appeal
const FloatingParticles = () => {
  const particles = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 3, // Smaller particles
    x: (Math.random() - 0.5) * 180,
    y: (Math.random() - 0.5) * 180,
    duration: Math.random() * 25 + 20, // Much slower movement
    delay: Math.random() * 3,
  }));

  return (
    <>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-orange-300"
          style={{
            width: particle.size,
            height: particle.size,
            x: particle.x,
            y: particle.y,
            opacity: 0.3,
            zIndex: 5,
          }}
          animate={{
            y: [particle.y, particle.y - 10, particle.y], // Reduced movement
            x: [particle.x, particle.x + 5, particle.x], // Reduced movement
            opacity: [0.15, 0.3, 0.15], // More subtle opacity changes
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut", // Smoother movement
          }}
        />
      ))}
    </>
  );
};

export default ExperienceCounter;
