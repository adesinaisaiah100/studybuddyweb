import HeroSection from './components/heroSection'
import UniversityTrustBar from './components/UniversityTrustBar'
import ConceptSection from './components/ConceptSection'


export default function Home() {
  return (
    <>
    <div className='bg-white'>
      <HeroSection />
      <UniversityTrustBar />
      <ConceptSection />
      </div>
    </>
  );
}
