import HomeBackground from '@/components/HomeBackground'

export default function ProfileLoading() {
  return (
    <>
      <HomeBackground noMars />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="fp-dots">
          <span className="fp-dot" />
          <span className="fp-dot" />
          <span className="fp-dot" />
        </div>
      </div>
    </>
  )
}
