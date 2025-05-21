import gsap from "gsap";
import PropTypes from "prop-types";
import { useEffect, useRef } from "react";
import ProfileCard from "./ProfileCard";

const AboutSection = ({
  title,
  description,
  profile,
  bgMode = "light",
  inDialog = false,
}) => {
  const sectionRef = useRef(null);
  const textRef = useRef(null);
  const titleRef = useRef(null);
  const descriptionRef = useRef(null);
  const profileCardRef = useRef(null);
  const highlightBarRef = useRef(null);

  useEffect(() => {
    // Create a GSAP timeline for animations
    const tl = gsap.timeline();

    // Different animation sequences based on where the component is rendered
    if (inDialog) {
      // More elaborate animations for dialog mode

      // Title animation
      tl.fromTo(
        titleRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" }
      );

      // Add highlight bar animation
      tl.fromTo(
        highlightBarRef.current,
        { width: 0, opacity: 0 },
        { width: "60px", opacity: 1, duration: 0.5, ease: "power2.out" }
      );

      // Description paragraphs animation with stagger
      tl.fromTo(
        descriptionRef.current.querySelectorAll("p"),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.2,
          duration: 0.7,
          ease: "power3.out",
        },
        "-=0.3"
      );

      // Profile card animation
      tl.fromTo(
        profileCardRef.current,
        { x: 50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: "back.out(1.4)" },
        "-=0.5"
      );
    } else {
      // Standard animations for normal page rendering
      tl.fromTo(
        textRef.current.querySelectorAll("h2, p"),
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.2, duration: 0.7, ease: "power3.out" }
      );
    }

    return () => tl.kill(); // Clean up animation
  }, [inDialog]);

  // Set styles based on light/dark mode
  const bgColor = bgMode === "light" ? "bg-white" : "bg-gray-900";
  const textColor = bgMode === "light" ? "text-gray-800" : "text-white";
  const secondaryTextColor =
    bgMode === "light" ? "text-gray-600" : "text-gray-300";
  const cardBgColor = bgMode === "light" ? "#111111" : "#1a1a1a";
  const cardTextColor = "#ffffff";
  const highlightColor = bgMode === "light" ? "bg-orange-500" : "bg-orange-400";

  return (
    <section
      ref={sectionRef}
      className={`about-section ${bgColor} py-8 px-4 md:px-6 lg:px-12 transition-colors duration-300`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6">
        <div ref={textRef} className="about-text">
          <h2
            ref={titleRef}
            className={`text-2xl md:text-3xl font-bold mb-4 ${textColor}`}
          >
            {title}
          </h2>

          {/* Highlight bar for visual interest */}
          <div
            ref={highlightBarRef}
            className={`h-1 ${highlightColor} rounded-full mb-6`}
          ></div>

          <div
            ref={descriptionRef}
            className={`space-y-3 ${secondaryTextColor}`}
          >
            {description.map((paragraph, index) => (
              <p key={index} className="text-base md:text-lg leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div ref={profileCardRef}>
          <ProfileCard
            image={profile.image}
            name={profile.name}
            role={profile.role}
            email={profile.email}
            address={profile.address}
            linkFace={profile.linkFace}
            linkInstagram={profile.linkInstagram}
            linkLinkedln={profile.linkLinkedln}
            linkGit={profile.linkGit}
            bgColor={cardBgColor}
            textColor={cardTextColor}
          />
        </div>
      </div>
    </section>
  );
};

AboutSection.propTypes = {
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
  inDialog: PropTypes.bool,
};

export default AboutSection;
