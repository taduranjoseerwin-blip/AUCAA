export default function EyeIcon({ visible = false }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {visible ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 002.8 2.8" />
          <path d="M6.2 6.2C3.9 7.9 3 11 3 11s3.5 7 9 7c1.8 0 3.4-.4 4.8-1.1" />
          <path d="M10.2 5.3A10 10 0 0112 5c5.5 0 9 6 9 6a18 18 0 01-2.1 3.3" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}
