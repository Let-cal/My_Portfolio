import { useEffect, useState } from "react";
import MobileSummaryModal from "../../../ui/mobile_summary_modal";
import ProfileImage from "./ProfileImage";
import SummaryOverlay from "./SummaryOverlay";

const ProfileCard = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Track window resize for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Handle hover interactions
  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsHovered(false);
    }
  };

  // Handle tap on mobile
  const handleCardClick = () => {
    if (isMobile) {
      setIsModalOpen(true);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div
      className="relative cursor-pointer"
      style={{
        maxWidth: isMobile ? "240px" : "340px",
        margin: "0 auto",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      {/* Profile Image with hover effects */}
      <ProfileImage isHovered={isHovered} isMobile={isMobile} />

      {/* Professional Summary overlay on hover (desktop) */}
      <SummaryOverlay isHovered={isHovered} isMobile={isMobile} />

      {/* Mobile Modal */}
      {isMobile && isModalOpen && (
        <MobileSummaryModal onClose={handleCloseModal} />
      )}
    </div>
  );
};

export default ProfileCard;
