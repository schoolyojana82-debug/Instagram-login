// src/pages/Login.jsx
import { useState } from "react";
import axios from "axios";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await axios.post(
        import.meta.env.VITE_API_URL + "/auth/login",
        { identifier, password },
        { withCredentials: true } // if backend sets cookie
      );
      // res.data should contain token or user
      console.log("Login success", res.data);
      // Redirect or set app state here
      window.location.href = "/feed";
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded shadow">
        <div className="text-center mb-6">
          <div className="text-4xl">📸</div>
          <h1 className="text-2xl font-semibold mt-2">Instagram Clone</h1>
        </div>

        {error && <div className="bg-red-100 p-2 mb-4 text-red-700 rounded">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            placeholder="Username or email or phone"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full p-3 border rounded focus:outline-none"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border rounded focus:outline-none"
          />
          <button className="w-full p-3 bg-blue-600 text-white rounded">Log in</button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-500">
          Don't have an account? <a href="/register" className="text-blue-600">Sign up</a>
        </div>
      </div>
    </div>
  );
}
