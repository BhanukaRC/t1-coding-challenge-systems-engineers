import { useEffect, useState } from "react";

const unseHealth = () => {
  const [health, setHealth] = useState({
    status: "UNKNOWN",
  });
  useEffect(() => {
    fetch("http://localhost:3001/health", {})
      .then((response) => response.json())
      .then((data) => {
        setHealth(data);
      });
  }, []);

  return health;
};

const ServiceHealth = () => {
  const health = unseHealth();
  return <p>{health.status}</p>;
};

export default ServiceHealth;
