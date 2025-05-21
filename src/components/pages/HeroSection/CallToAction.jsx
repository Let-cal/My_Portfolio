import { motion } from "framer-motion";
import { useState } from "react";
import MobileSummaryModal from "../../ui/mobile_summary_modal";

// eslint-disable-next-line react/prop-types
const CallToAction = ({ setShowAbout, showAbout }) => {
  const [isMobile, setIsMobile] = useState(false);

  // Sample data for AboutSection
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

  // Detect mobile screen
  useState(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Mobile and tablet (below 1024px)
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const buttonVariants = {
    hover: {
      scale: 1.05,
      boxShadow: "0px 5px 15px rgba(251, 146, 60, 0.4)",
      transition: { duration: 0.3 },
    },
    tap: { scale: 0.95 },
  };

  const linkVariants = {
    hover: { x: 5, color: "#FB923C", transition: { duration: 0.2 } },
  };

  const toggleAbout = () => {
    setShowAbout((prev) => !prev);
  };

  const handleProjectsClick = () => {
    const section = document.getElementById("experience");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <motion.div
        className="flex flex-col items-center gap-4 mt-2"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <motion.button
          className="px-8 py-3 bg-orange-400 text-white rounded-full font-medium text-lg shadow-sm"
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={() => console.log("View Portfolio clicked")}
        >
          View Portfolio
        </motion.button>

        <div className="flex gap-6 mt-4">
          {[
            { name: "Projects", action: handleProjectsClick },
            { name: "About", action: toggleAbout },
            { name: "Contact", action: () => console.log("Contact clicked") },
          ].map((item, index) => (
            <motion.button
              key={item.name}
              onClick={item.action}
              className={`text-gray-800 font-medium text-lg relative group ${
                item.name === "About" && showAbout ? "text-orange-400" : ""
              }`}
              variants={linkVariants}
              whileHover="hover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 + index * 0.1 }}
            >
              {item.name}
              <motion.span
                className={`absolute bottom-0 left-0 h-0.5 bg-orange-400 ${
                  item.name === "About" && showAbout ? "w-full" : "!w-0"
                }`}
                whileHover={{ width: "100%" }}
                animate={
                  item.name === "About" && showAbout ? { width: "100%" } : {}
                }
                transition={{ duration: 0.3 }}
              />
            </motion.button>
          ))}
        </div>

        {/* AboutSection will be rendered in HeroSection.jsx */}
      </motion.div>

      {/* Mobile AboutSection Modal */}
      {isMobile && showAbout && (
        <MobileSummaryModal
          onClose={toggleAbout}
          isAboutSection={true}
          aboutData={aboutData}
        />
      )}
    </>
  );
};

export default CallToAction;
