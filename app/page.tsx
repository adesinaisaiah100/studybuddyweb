import HeroSection from './components/heroSection'
import UniversityTrustBar from './components/UniversityTrustBar'
import ConceptSection from './components/ConceptSection'
import FeaturesSection from './components/FeaturesSection'
import HowItWorksSection from './components/HowItWorksSection'
import KeyBenefitsSection from './components/KeyBenefitsSection'
import SocialProofSection from './components/SocialProofSection'
import CtaSection from './components/CtaSection'
import Footer from './components/Footer'

export default function Home() {
  return (
    <>
    <div className='bg-white'>
      <HeroSection />
      <UniversityTrustBar />
      <ConceptSection />
      <FeaturesSection />
      <HowItWorksSection />
      <KeyBenefitsSection />
      <SocialProofSection />
      <CtaSection />
      <Footer />
      </div>
    </>
  );
}
