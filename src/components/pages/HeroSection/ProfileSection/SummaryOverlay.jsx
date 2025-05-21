import { Box, Card, Typography } from "@mui/material";
import gsap from "gsap";
import { useEffect, useRef } from "react";

// eslint-disable-next-line react/prop-types
const SummaryOverlay = ({ isHovered, isMobile }) => {
  const summaryRef = useRef(null);
  const contentRef = useRef(null);
  const accentLineRef = useRef(null);

  // Initialize and manage GSAP animations
  useEffect(() => {
    // Set initial state
    gsap.set(summaryRef.current, {
      opacity: 0,
      visibility: "hidden",
    });

    return () => {
      // Cleanup any active animations
      gsap.killTweensOf(summaryRef.current);
      gsap.killTweensOf(contentRef.current);
      gsap.killTweensOf(accentLineRef.current);
    };
  }, []);

  // Handle animations on hover state change
  useEffect(() => {
    if (!summaryRef.current) return;

    if (isHovered && !isMobile) {
      // First make it visible without animation
      gsap.set(summaryRef.current, {
        visibility: "visible",
        opacity: 0,
      });

      // Create timeline for coordinated animations
      const tl = gsap.timeline();

      // Main card animation
      tl.to(summaryRef.current, {
        opacity: 1,
        duration: 0.4,
        ease: "power1.out",
      });

      // Accent line animation
      tl.fromTo(
        accentLineRef.current,
        { scaleY: 0, transformOrigin: "top" },
        { scaleY: 1, duration: 0.25, ease: "power1.out" },
        "-=0.2" // Start slightly before the main animation completes
      );

      // Content animation - text appears with slight delay
      tl.fromTo(
        contentRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power1.out" },
        "-=0.15" // Start slightly before the accent line animation completes
      );
    } else {
      // Hide summary with fade out
      gsap.to(summaryRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: "power1.in",
        onComplete: () => {
          gsap.set(summaryRef.current, { visibility: "hidden" });
        },
      });
    }
  }, [isHovered, isMobile]);

  // Different positioning for desktop and mobile
  const positionStyle = isMobile
    ? {
        position: "absolute",
        left: "50%",
        bottom: "20px",
        transform: "translateX(-50%)",
        width: "80%",
        maxWidth: "220px",
      }
    : {
        position: "absolute",
        top: "15%",
        right: "-180px",
        width: "280px",
      };

  return (
    <Box
      ref={summaryRef}
      className="z-20"
      sx={{
        ...positionStyle,
        pointerEvents: "none", // Prevents hover issues
      }}
    >
      <Card
        elevation={3}
        sx={{
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(8px)",
          borderRadius: "12px",
          border: "1px solid rgba(251, 146, 60, 0.3)",
          padding: { xs: 2, md: 2.5 },
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.15)",
          overflow: "hidden",
        }}
      >
        {/* Title with animated orange accent */}
        <Box className="flex mb-2">
          <Box
            ref={accentLineRef}
            className="bg-orange-400 mr-3"
            sx={{
              width: "3px",
              height: "24px",
              borderRadius: "3px",
            }}
          />

          <Typography
            variant="subtitle1"
            component="h3"
            className="text-gray-700 font-medium"
            sx={{
              fontSize: "0.95rem",
              textTransform: "uppercase",
              letterSpacing: "0.05rem",
              fontWeight: 500,
            }}
          >
            Professional Summary
          </Typography>
        </Box>

        {/* Summary Content with animation */}
        <Box ref={contentRef}>
          <Typography
            className="text-gray-800"
            sx={{
              fontSize: "0.9rem",
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Front-End Developer with 3+ years of expertise in React ecosystem
            and modern JavaScript. Passionate about creating responsive,
            accessible interfaces with clean animations and optimal performance.
          </Typography>
        </Box>
      </Card>
    </Box>
  );
};

export default SummaryOverlay;
