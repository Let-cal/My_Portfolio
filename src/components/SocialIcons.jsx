import gsap from "gsap";
import { useEffect, useRef } from "react";
import {
  FaFacebook,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa";

const SocialIcons = () => {
  const containerRef = useRef(null);
  const iconRefs = useRef([]);

  // Initialize animations when component mounts
  useEffect(() => {
    if (!containerRef.current) return;

    // Animation for the main brand icon
    gsap.fromTo(
      containerRef.current.querySelector(".brand-icon"),
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }
    );

    // Animation for the social icons
    gsap.fromTo(
      iconRefs.current,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.4,
        stagger: 0.1,
        delay: 0.3,
        ease: "back.out(2)",
      }
    );

    // Hover animations for icons
    iconRefs.current.forEach((icon) => {
      if (!icon) return;

      icon.addEventListener("mouseenter", () => {
        gsap.to(icon, {
          y: -5,
          scale: 1.2,
          color: "#f97316", // orange-500
          duration: 0.3,
          ease: "power2.out",
        });
      });

      icon.addEventListener("mouseleave", () => {
        gsap.to(icon, {
          y: 0,
          scale: 1,
          color: "#4b5563", // gray-600
          duration: 0.3,
          ease: "power2.out",
        });
      });
    });

    return () => {
      // Cleanup event listeners
      iconRefs.current.forEach((icon) => {
        if (!icon) return;
        icon.removeEventListener("mouseenter", () => {});
        icon.removeEventListener("mouseleave", () => {});
      });
    };
  }, []);

  // Social links
  const socialLinks = [
    {
      Icon: FaGithub,
      url: "https://github.com/Let-cal",
      label: "GitHub Profile",
    },
    {
      Icon: FaLinkedinIn,
      url: "https://linkedin.com/in/letcal",
      label: "LinkedIn Profile",
    },
    {
      Icon: FaFacebook,
      url: "https://www.facebook.com/lam.cat.77770/",
      label: "Twitter Profile",
    },
    {
      Icon: FaInstagram,
      url: "https://www.instagram.com/lam.ltc/",
      label: "Dribbble Profile",
    },
  ];

  return (
    <div ref={containerRef} className="flex items-center gap-3">
      {/* Brand icon */}
      <div className="brand-icon flex items-center justify-center w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full shadow-md hover:shadow-orange-300/50 transition-shadow duration-300">
        <span className="text-white font-bold text-sm">LC</span>
      </div>

      {/* Social icons */}
      <div className="flex gap-2">
        {socialLinks.map((social, index) => (
          <a
            key={index}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            ref={(el) => (iconRefs.current[index] = el)}
            className="text-gray-600 hover:text-orange-500 transition-colors duration-300"
          >
            <social.Icon className="w-4 h-4" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default SocialIcons;
