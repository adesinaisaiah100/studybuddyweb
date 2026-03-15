import HeroSection from './components/heroSection'
import UniversityTrustBar from './components/UniversityTrustBar'
import ConceptSection from './components/ConceptSection'
import FeaturesSection from './components/FeaturesSection'
import HowItWorksSection from './components/HowItWorksSection'

export default function Home() {
  return (
    <>
    <div className='bg-white'>
      <HeroSection />
      <UniversityTrustBar />
      <ConceptSection />
      <FeaturesSection />
      <HowItWorksSection />
      </div>
    </>
  );
}
