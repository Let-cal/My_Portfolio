// LogoTitle.jsx with synchronized animations
import { motion } from "framer-motion";
import gsap from "gsap";
import { useEffect, useRef } from "react";

// Helper function to wrap text in spans
const wrapTextInSpans = (text) => {
  return text.split("").map((char, index) => (
    <span key={index} className="inline-block">
      {char === " " ? "\u00A0" : char}
    </span>
  ));
};

// eslint-disable-next-line react/prop-types
export default function LogoTitle({ showAbout, isMobile }) {
  const logoTitleRef = useRef(null);
  const timelineRef = useRef(null);
  const effectiveShowAbout = isMobile || showAbout;
  const variants = {
    hidden: { opacity: 0, y: -20 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  // GSAP explode-and-gather animation
  useEffect(() => {
    if (!showAbout && logoTitleRef.current) {
      // Get all letter spans
      const letters = logoTitleRef.current.querySelectorAll("h1 span, h2 span");

      // Clear any existing animations first
      if (timelineRef.current) {
        timelineRef.current.kill();
      }

      // Set initial random positions - KEPT THE SAME as ExperienceCounter
      gsap.set(letters, {
        x: () => gsap.utils.random(-500, 500),
        y: () => gsap.utils.random(-500, 500),
        rotation: () => gsap.utils.random(-720, 720),
        scale: 0,
        opacity: 0,
      });

      // Create timeline with exact same settings
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.65,
        yoyo: true,
      });

      // Add animation to timeline with exact same parameters as ExperienceCounter
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
  }, [showAbout]);

  // Mouse event handlers for the container - KEEP IDENTICAL to ExperienceCounter
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

  // Nếu showAbout thì chỉ hiển thị text mà thôi
  if (effectiveShowAbout) {
    return (
      <div className="flex flex-col items-center">
        <motion.h1
          className="text-4xl font-bold text-orange-500"
          initial="hidden"
          animate="enter"
          variants={variants}
        >
          Front-End
        </motion.h1>
        <motion.h2
          className="text-2xl font-semibold text-orange-500 mb-5"
          initial="hidden"
          animate="enter"
          variants={variants}
        >
          Developer
        </motion.h2>
      </div>
    );
  }

  // Ngược lại, khi chưa showAbout thì show logo + text với animation
  return (
    <motion.div
      className="flex flex-col items-center space-y-4 flex-shrink-0"
      initial="hidden"
      animate="enter"
      variants={variants}
      ref={logoTitleRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.img
        src="/images/LETCAL_STUDIO-removebg-preview.png"
        alt="Studio Logo"
        className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48"
        whileHover={{ scale: 1.1 }}
      />
      <motion.h1 className="text-5xl font-bold text-orange-500">
        {wrapTextInSpans("Front-End")}
      </motion.h1>
      <motion.h2 className="text-2xl font-semibold text-orange-500">
        {wrapTextInSpans("Developer")}
      </motion.h2>
    </motion.div>
  );
}
