import { Box, Typography } from "@mui/material";
import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
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

  // Define handleClose before useEffect
  const handleClose = () => {
    if (!modalRef.current || !overlayRef.current) {
      onClose();
      return;
    }

    const modal = modalRef.current;
    const overlay = overlayRef.current;

    animateElement(
      modal,
      { y: 0 },
      { y: "100%" },
      { duration: 0.3, ease: "power2.in" }
    );
    animateElement(
      overlay,
      { opacity: 1 },
      { opacity: 0 },
      {
        duration: 0.3,
        onComplete: onClose,
      }
    );
  };

  useEffect(() => {
    if (!modalRef.current || !overlayRef.current || !contentRef.current) return;

    const modal = modalRef.current;
    const overlay = overlayRef.current;
    const contentChildren = contentRef.current.children;

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
    // Don't immediately close - this will make debugging easier
    // Instead, let's render a helpful error message
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-white p-6 rounded-lg max-w-md">
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
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay with full coverage and blur */}
      <Box
        ref={overlayRef}
        className="fixed top-0 left-0 w-full h-full z-50 bg-black/70"
        onClick={handleClose}
        sx={{
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)", // Ensure compatibility with Safari
        }}
      />

      {/* Modal content with scrollable area */}
      <Box
        ref={modalRef}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl"
        sx={{
          maxHeight: "80vh",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box
          className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2 mb-4"
          sx={{ cursor: "grab" }}
        />
        {/* Scrollable content area */}
        <Box
          className="px-5 pb-8 flex-1 overflow-y-auto"
          ref={contentRef}
          sx={{
            scrollbarWidth: "thin", // For Firefox
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              borderRadius: "3px",
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
          <Box
            className="w-full py-3 text-center text-white font-medium rounded-lg bg-orange-500"
            onClick={handleClose}
            sx={{
              cursor: "pointer",
              "&:hover": { backgroundColor: "rgb(249, 115, 22)" },
            }}
          >
            Close
          </Box>
        </Box>
      </Box>
    </>
  );
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
