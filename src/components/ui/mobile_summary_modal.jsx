import { Box, Typography } from "@mui/material";
import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AboutSection from "../pages/About/AboutSection";

// Utility function to animate elements
const animateElement = (element, from, to, options) => {
  gsap.fromTo(element, from, { ...to, ...options });
};

// Utility function to kill tweens
const cleanupTweens = (elements) => {
  elements.forEach((el) => el && gsap.killTweensOf(el));
};

const MobileSummaryModal = ({ onClose, isAboutSection = false, aboutData }) => {
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const overlayRef = useRef(null);
  const [isClosing, setIsClosing] = useState(false);

  // Handle close with animation
  const handleClose = () => {
    if (isClosing) return; // Prevent multiple clicks

    setIsClosing(true);

    if (!modalRef.current || !overlayRef.current) {
      onClose();
      return;
    }

    const modal = modalRef.current;
    const overlay = overlayRef.current;

    // GSAP closing animation
    const tl = gsap.timeline({
      onComplete: onClose,
    });

    tl.to(modal, {
      y: "100%",
      duration: 0.4,
      ease: "power3.in",
    });

    tl.to(
      overlay,
      {
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
      },
      "-=0.2"
    );
  };

  useEffect(() => {
    if (!modalRef.current || !overlayRef.current || !contentRef.current) return;

    const modal = modalRef.current;
    const overlay = overlayRef.current;
    const contentChildren = contentRef.current.children;

    // Store current scroll position
    const scrollY = window.scrollY;

    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    // Store original body styles to restore later
    const originalBodyStyle = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    };

    // Fix body position to prevent background scroll
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    // Slide up animation for modal
    animateElement(
      modal,
      { y: "100%" },
      { y: 0 },
      { duration: 0.5, ease: "power3.out" }
    );

    // Fade in overlay
    animateElement(overlay, { opacity: 0 }, { opacity: 1 }, { duration: 0.3 });

    // Fade in content with stagger
    if (contentChildren && contentChildren.length > 0) {
      animateElement(
        contentChildren,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0 },
        {
          duration: 0.4,
          stagger: 0.1,
          delay: 0.2,
          ease: "power2.out",
        }
      );
    }

    const handleEscKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscKey);

    return () => {
      window.removeEventListener("keydown", handleEscKey);

      // Restore body styles
      document.body.style.position = originalBodyStyle.position || "";
      document.body.style.top = originalBodyStyle.top || "";
      document.body.style.left = originalBodyStyle.left || "";
      document.body.style.right = originalBodyStyle.right || "";
      document.body.style.width = originalBodyStyle.width || "";
      document.body.style.overflow = "";

      // Restore scroll position smoothly
      window.scrollTo(0, scrollY);

      cleanupTweens([modal, overlay, ...(contentChildren || [])]);
    };
  }, []);

  // Safety check to prevent rendering if aboutData is incomplete when isAboutSection is true
  if (
    isAboutSection &&
    (!aboutData ||
      !aboutData.title ||
      !aboutData.description ||
      !aboutData.profile)
  ) {
    console.error("AboutData is missing required properties");

    const errorModal = (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50 z-[9999]"
        style={{
          position: "fixed",
          zIndex: 9999,
          opacity: isClosing ? 0 : 1,
          transition: "opacity 0.3s ease-out",
        }}
      >
        <div className="bg-white p-6 rounded-lg max-w-md mx-4">
          <h3 className="text-xl font-bold text-red-600 mb-4">
            Error Loading About Section
          </h3>
          <p className="mb-4">
            The aboutData prop is missing required properties:
          </p>
          <ul className="list-disc pl-6 mb-4">
            {!aboutData && <li>aboutData is undefined</li>}
            {aboutData && !aboutData.title && <li>Missing title</li>}
            {aboutData && !aboutData.description && (
              <li>Missing description</li>
            )}
            {aboutData && !aboutData.profile && <li>Missing profile</li>}
          </ul>
          <button
            className="w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    );

    return createPortal(errorModal, document.body);
  }

  const modalContent = (
    <>
      {/* Overlay with maximum z-index and full coverage */}
      <Box
        ref={overlayRef}
        className="fixed top-0 left-0 w-full h-full bg-black/70"
        onClick={handleClose}
        sx={{
          position: "fixed !important",
          zIndex: 9999,
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          touchAction: "none", // Prevent touch scrolling on overlay
        }}
      />

      {/* Modal content with maximum z-index and proper positioning */}
      <Box
        ref={modalRef}
        className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl"
        sx={{
          position: "fixed !important",
          zIndex: 9999,
          maxHeight: "85vh",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          margin: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: "translateZ(0)", // Force hardware acceleration
          willChange: "transform", // Optimize for animations
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <Box
          className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 mb-4 cursor-grab active:cursor-grabbing"
          onClick={handleClose}
        />

        {/* Scrollable content area */}
        <Box
          className="px-5 pb-8 flex-1 overflow-y-auto"
          ref={contentRef}
          sx={{
            scrollbarWidth: "thin",
            touchAction: "pan-y", // Allow vertical scrolling only
            "&::-webkit-scrollbar": {
              width: "4px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              borderRadius: "2px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "rgba(0, 0, 0, 0.1)",
            },
          }}
        >
          {isAboutSection && aboutData ? (
            <AboutSection
              title={aboutData.title}
              description={aboutData.description}
              profile={aboutData.profile}
              bgMode={aboutData.bgMode || "light"}
              inDialog={true}
            />
          ) : (
            <>
              <Box className="mb-4 pb-2 border-b border-gray-200">
                <Typography
                  variant="h6"
                  className="text-gray-800 font-medium"
                  sx={{ fontSize: "1.25rem" }}
                >
                  Professional Summary
                </Typography>
              </Box>
              <Box
                className="w-20 h-1 bg-orange-400 mb-4"
                sx={{ borderRadius: "2px" }}
              />
              <Typography className="text-gray-700 mb-4">
                Front-End Developer with 3+ years of expertise in React
                ecosystem and modern JavaScript.
              </Typography>
              <Typography className="text-gray-700 mb-5">
                Passionate about creating responsive, accessible interfaces with
                clean animations and optimal performance.
              </Typography>
              <Box className="flex flex-wrap gap-2 mb-6">
                {[
                  "ReactJs",
                  "NextJs",
                  "JavaScript",
                  "TypeScript",
                  "Dart & Flutter",
                  "TailwindCSS",
                  "Shadcn-ui",
                  "GSAP",
                  "Material-UI",
                ].map((skill) => (
                  <Box
                    key={skill}
                    className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm"
                  >
                    {skill}
                  </Box>
                ))}
              </Box>
            </>
          )}

          {/* Close button */}
          <Box
            className="w-full py-3 text-center text-white font-medium rounded-lg bg-orange-500 mt-6"
            onClick={handleClose}
            sx={{
              cursor: "pointer",
              transition: "background-color 0.2s ease",
              "&:hover": { backgroundColor: "rgb(249, 115, 22)" },
              "&:active": {
                backgroundColor: "rgb(234, 88, 12)",
                transform: "scale(0.98)",
              },
            }}
          >
            Close
          </Box>
        </Box>
      </Box>
    </>
  );

  // Use React Portal to render modal at document.body level
  return createPortal(modalContent, document.body);
};

MobileSummaryModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  isAboutSection: PropTypes.bool,
  aboutData: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.arrayOf(PropTypes.string),
    profile: PropTypes.shape({
      image: PropTypes.string,
      name: PropTypes.string,
      role: PropTypes.string,
      email: PropTypes.string,
      address: PropTypes.string,
      linkFace: PropTypes.string,
      linkInstagram: PropTypes.string,
      linkLinkedln: PropTypes.string,
      linkGit: PropTypes.string,
    }),
    bgMode: PropTypes.oneOf(["light", "dark"]),
  }),
};

export default MobileSummaryModal;
