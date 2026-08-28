async function testFetch() {
  try {
    console.log("Intentando conectar a Google...");
    const res = await fetch("https://www.google.com");
    console.log("✅ ¡Éxito! Status:", res.status);
  } catch (error) {
    console.error("❌ Error de conexión:", error);
  }
}
testFetch();