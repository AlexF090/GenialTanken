import { useState } from 'react';
import './App.css';
import data from './data/db';

function App() {
  const [stations, setStations] = useState([]);
  console.log(data);

  return (
    <div className="App">
      <h1>Users</h1>
      <ul>
        {data.map(station => (
          <li className="listItems" key={station.uuid}>
            {station.e5} {station.name} {station.street}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
