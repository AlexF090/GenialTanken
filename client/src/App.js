import { useState } from 'react';
import './App.css';
import data from './data/db';

function App() {
  const [users, setUsers] = useState([]);
  console.log(data);
  function fetchSomething() {
    fetch('/api')
      .then(res => res.json())
      .then(data => setUsers(data));
  }

  return (
    <div className="App">
      <h1>Users</h1>
      <button onClick={fetchSomething}>Fetch users</button>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
