import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import AboutSection from "../About/AboutSection";
import Background from "./Background";
import CallToAction from "./CallToAction";
import ExperienceCounter from "./ExperienceCounter";
import LogoTitle from "./LogoTitle";
import ProfileCard from "./ProfileSection/ProfileCard";

const HeroSection = () => {
  const aboutData = {
    title: "About Me",
    description: [
      "I'm a Front-end - Web/App Mobile Developer with over 2 years of experience in React.js, TypeScript, JavaScript, Next.js, and Dart & Flutter.",
      "I build clean, modular, high-performance applications, design user-centric interfaces, and thrive in cross-functional collaboration. I'm passionate about crafting innovative solutions that elevate user engagement and drive results.",
    ],
    profile: {
      image: "/images/test0123-removebg-preview.png",
      name: "Le Tran Cat Lam",
      role: "Front-End Developer",
      email: "letcal2003@gmail.com",
      address: "Ho Chi Minh City, VietNam",
      linkFace: "https://www.facebook.com/lam.cat.77770/",
      linkInstagram: "https://www.instagram.com/lam.ltc/",
      linkLinkedln: "https://www.linkedin.com/in/letcal",
      linkGit: "https://github.com/Let-cal",
    },
    bgMode: "light",
  };
  const [showAbout, setShowAbout] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const effectiveShowAbout = isMobile || showAbout;

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Main container variants - carefully orchestrated for smooth transitions
  const containerVariants = {
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      transition: {
        duration: 0.8,
        ease: "easeInOut",
        staggerChildren: 0.1,
        when: "beforeChildren",
      },
    },
    column: {
      flexDirection: "column",
      justifyContent: "flex-start",
      alignItems: "center",
      transition: {
        duration: 0.8,
        ease: "easeInOut",
        staggerChildren: 0.1,
        when: "beforeChildren",
      },
    },
  };

  // Logo variants with path-based animation for smooth movement
  const logoVariants = {
    row: {
      x: isMobile ? 0 : "0%",
      y: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: 0.8, ease: "easeInOut" },
    },
    column: {
      x: 0,
      y: isMobile ? 20 : 0,
      opacity: 1,
      scale: isMobile ? 0.9 : 0.95,
      transition: { duration: 0.8, ease: "easeInOut" },
    },
  };

  // Experience counter variants - synchronized with AboutSection appearance
  const experienceVariants = {
    row: {
      x: isMobile ? 0 : "0%",
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeInOut" },
    },
    column: {
      x: 0,
      y: 0,
      opacity: 0,
      transition: {
        duration: 0.6,
        ease: "easeInOut",
      },
    },
  };

  // Profile card variants - stays centered and stable during transitions
  const profileVariants = {
    row: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.8, ease: "easeInOut" },
    },
    column: {
      y: 0, // Don't move it down when in column mode
      opacity: 1,
      transition: { duration: 0.8, ease: "easeInOut" },
    },
  };

  // About section variants to create a seamless appearance with ExperienceCounter fade-out
  const aboutVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      height: 0,
      transition: { duration: 0.4, ease: "easeInOut" },
    },
    visible: {
      opacity: 1,
      y: 0,
      height: "auto",
      transition: {
        duration: 0.8,
        ease: "easeInOut",
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <section className="relative w-full min-h-screen bg-white overflow-hidden pt-16 lg:pt-24 lg:pb-16 pb-8">
      <Background />

      {/* Main container - transitions between row and column layouts */}
      <motion.div
        className="container mx-auto px-4 h-full relative z-10 flex items-center space-y-0 lg:space-x-12"
        variants={containerVariants}
        initial="row"
        animate={effectiveShowAbout ? "column" : "row"}
      >
        {/* Logo Title - smoothly moves to the top when About is shown */}
        <motion.div
          className={`flex-shrink-0 ${effectiveShowAbout ? "w-full" : ""}`}
          variants={logoVariants}
        >
          <LogoTitle showAbout={showAbout} isMobile={isMobile} />
        </motion.div>

        {/* Profile and CTA - stays centered but adjusts position */}
        <motion.div
          className={`!ml-0 flex flex-col items-center space-y-6  flex-shrink-0 ${
            effectiveShowAbout ? "w-full z-20" : ""
          }`}
          variants={profileVariants}
        >
          <ProfileCard />
          <CallToAction setShowAbout={setShowAbout} showAbout={showAbout} />
        </motion.div>

        {/* Experience Counter - fades out when About is shown */}
        <motion.div
          className={`flex-shrink-0 ${effectiveShowAbout ? "absolute" : ""}`}
          variants={experienceVariants}
          // Set to position absolute when hidden to remove from layout flow
          style={{ visibility: effectiveShowAbout ? "hidden" : "visible" }}
        >
          <ExperienceCounter years={3} />
        </motion.div>
      </motion.div>

      {/* AboutSection with AnimatePresence for smooth enter/exit animations */}
      <AnimatePresence>
        {showAbout && !isMobile && (
          <motion.div
            className="w-full px-4 relative z-10 mt-12"
            variants={aboutVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            key="about-section"
          >
            <AboutSection
              title={aboutData.title}
              description={aboutData.description}
              profile={aboutData.profile}
              bgMode={aboutData.bgMode}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default HeroSection;
