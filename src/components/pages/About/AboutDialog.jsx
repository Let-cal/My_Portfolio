import { Box } from "@mui/material";
import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import AboutSection from "./AboutSection";

const AboutDialog = ({ onClose, aboutData }) => {
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    // Ensure we have our references
    if (!dialogRef.current || !overlayRef.current || !contentRef.current)
      return;

    // Prevent body scrolling
    document.body.style.overflow = "hidden";

    // Start with translated and scaled state
    gsap.set(dialogRef.current, {
      y: 50,
      opacity: 0,
      scale: 0.9,
    });

    // Create a timeline for coordinated animations
    const tl = gsap.timeline();

    // Fade in overlay with blur effect
    tl.to(overlayRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    });

    // Bring in the dialog with a slight bounce
    tl.to(
      dialogRef.current,
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: "back.out(1.2)",
      },
      "-=0.1"
    );

    // Add event listener for ESC key
    const handleEscKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscKey);

    return () => {
      // Clean up on unmount
      window.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = ""; // Restore scrolling

      // Kill any running animations
      gsap.killTweensOf([dialogRef.current, overlayRef.current]);
    };
  }, []);

  const handleClose = () => {
    if (!dialogRef.current || !overlayRef.current) {
      onClose();
      return;
    }

    const tl = gsap.timeline({
      onComplete: onClose,
    });

    // Scale and fade out the dialog
    tl.to(dialogRef.current, {
      y: 30,
      opacity: 0,
      scale: 0.95,
      duration: 0.4,
      ease: "power2.in",
    });

    // Fade out the overlay
    tl.to(
      overlayRef.current,
      {
        opacity: 0,
        duration: 0.3,
      },
      "-=0.2"
    );
  };

  // Safety check for required data
  if (
    !aboutData ||
    !aboutData.title ||
    !aboutData.description ||
    !aboutData.profile
  ) {
    console.error("AboutData is missing required properties in AboutDialog");
    return null;
  }

  return (
    <>
      {/* Overlay with blur effect */}
      <Box
        ref={overlayRef}
        className="fixed inset-0 z-50 bg-black/60"
        onClick={handleClose}
        sx={{
          opacity: 0,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          transition: "backdrop-filter 0.3s ease",
        }}
      />

      {/* Dialog container */}
      <Box
        ref={dialogRef}
        className="fixed z-50 bg-white rounded-xl overflow-hidden"
        sx={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 32px)",
          maxWidth: "1000px",
          maxHeight: "calc(100vh - 64px)",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          display: "flex",
          flexDirection: "column",
          opacity: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dialog content */}
        <Box
          ref={contentRef}
          className="flex-1 overflow-y-auto"
          sx={{
            scrollbarWidth: "thin",
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              borderRadius: "3px",
            },
          }}
        >
          {/* Close button */}
          <Box
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-gray-300"
            onClick={handleClose}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Box>

          {/* About section content */}
          <AboutSection
            title={aboutData.title}
            description={aboutData.description}
            profile={aboutData.profile}
            bgMode={aboutData.bgMode || "light"}
            inDialog={true}
          />
        </Box>
      </Box>
    </>
  );
};

AboutDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  aboutData: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.arrayOf(PropTypes.string).isRequired,
    profile: PropTypes.shape({
      image: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      role: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      address: PropTypes.string.isRequired,
      linkFace: PropTypes.string,
      linkInstagram: PropTypes.string,
      linkLinkedln: PropTypes.string,
      linkGit: PropTypes.string,
    }).isRequired,
    bgMode: PropTypes.oneOf(["light", "dark"]),
  }).isRequired,
};

export default AboutDialog;
