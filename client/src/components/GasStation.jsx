
import data from 'client/src/data/db.js';



const GasStation = ({ name, uuid, e5 }) => {
  const [gasStationDetailsOn, setGasStationDetailsOn] = useState(true);
  const [gasStation, setGasStation] = useState({});
  const handleDetails = () => {
    setGasStationDetailsOn(changeState => !changeState);
  };

//   useEffect(() => {
//     fetch('../data/db.js' + uuid).then(response =>
//       response.json().then(data => setGasStation(data))
//     );
//   }, []);

  return (
    <>
      {gasStationDetailsOn ? (
        <li onClick={handleDetails}>
          <h2>{name}</h2>
        </li>
      ) : (
        <li onClick={handleDetails}>
          <h2>{name}</h2>
          <h2>{e5}</h2>
        </li>
      )}
    </>
  );
};



export default GasStation;
