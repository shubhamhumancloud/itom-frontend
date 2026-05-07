export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div>
        <h1>Sign in required</h1>
        <p style={{ color: '#aab2cc' }}>
          Please sign in via the tenant portal to access ITOM.
        </p>
      </div>
    </main>
  );
}
