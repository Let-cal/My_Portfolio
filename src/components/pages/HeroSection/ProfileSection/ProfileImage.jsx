import { Box } from "@mui/material";
import gsap from "gsap";
import { useEffect, useRef } from "react";

// eslint-disable-next-line react/prop-types
const ProfileImage = ({ isHovered, isMobile }) => {
  const imageRef = useRef(null);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const glowRef = useRef(null);

  // Initialize GSAP animations
  useEffect(() => {
    // Initial image entrance animation
    gsap.fromTo(
      imageRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, delay: 0.3, ease: "power2.out" }
    );

    return () => {
      // Cleanup any active animations
      // eslint-disable-next-line react-hooks/exhaustive-deps
      gsap.killTweensOf(imageRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      gsap.killTweensOf(overlayRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      gsap.killTweensOf(cardRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      gsap.killTweensOf(glowRef.current);
    };
  }, []);

  // Handle hover animations
  useEffect(() => {
    if (!imageRef.current) return;

    if (isHovered) {
      // Image scale + color adjustment
      gsap.to(imageRef.current, {
        scale: 1.05,
        filter: "brightness(0.9) contrast(1.05)",
        duration: 0.5,
        ease: "power2.out",
      });

      // Card glow animation
      gsap.to(cardRef.current, {
        boxShadow: "0 8px 30px rgba(251, 146, 60, 0.3)",
        duration: 0.5,
      });

      // Overlay animation - darken image to make overlay text more readable
      gsap.to(overlayRef.current, {
        opacity: 0.65,
        duration: 0.5,
      });

      // Glow effect animation
      gsap.to(glowRef.current, {
        opacity: 0.8,
        scale: 1.1,
        duration: 0.8,
        ease: "sine.inOut",
      });
    } else {
      // Revert image scale + color
      gsap.to(imageRef.current, {
        scale: 1,
        filter: "brightness(1) contrast(1)",
        duration: 0.5,
        ease: "power2.out",
      });

      // Revert card glow
      gsap.to(cardRef.current, {
        boxShadow: "0 4px 12px rgba(251, 146, 60, 0.15)",
        duration: 0.5,
      });

      // Revert overlay
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.5,
      });

      // Revert glow effect
      gsap.to(glowRef.current, {
        opacity: 0,
        scale: 1,
        duration: 0.5,
      });
    }
  }, [isHovered]);

  return (
    <Box
      ref={cardRef}
      className="relative overflow-hidden"
      sx={{
        width: isMobile ? "240px" : "340px",
        height: isMobile ? "440px" : "550px",
        borderRadius: "16px",
        transition: "transform 0.3s ease",
        boxShadow: "0 4px 12px rgba(251, 146, 60, 0.15)",
        transform:
          isHovered && !isMobile ? "translateY(-5px)" : "translateY(0)",
      }}
    >
      {/* Profile image */}
      <Box
        ref={imageRef}
        component="img"
        src="/images/profile-portrait.png"
        alt="Profile Portrait"
        className="w-full h-full object-cover"
        sx={{
          borderRadius: "16px",
          transformOrigin: "center",
        }}
      />

      {/* Image overlay effect for darkening */}
      <Box
        ref={overlayRef}
        className="absolute inset-0 bg-gradient-to-b from-gray-900/30 via-gray-800/40 to-gray-900/50"
        sx={{
          borderRadius: "16px",
          opacity: 0,
        }}
      />

      {/* Glow effect */}
      <Box
        ref={glowRef}
        className="absolute -inset-1 rounded-xl opacity-0"
        sx={{
          background:
            "radial-gradient(circle at top right, rgba(251, 146, 60, 0.3), transparent 70%)",
          filter: "blur(10px)",
          zIndex: -1,
        }}
      />

      {/* Orange border accent - always visible but enhanced on hover */}
      <Box
        className="absolute inset-0 rounded-xl"
        sx={{
          border: "1px solid rgba(251, 146, 60, 0.3)",
          pointerEvents: "none",
          opacity: isHovered ? 1 : 0.7,
          transition: "opacity 0.3s ease",
        }}
      />
    </Box>
  );
};

export default ProfileImage;
