import logo from './logo.svg';
import './App.css';
import Admin from './pages/Admin/Admin';
import Party from './pages/Party/Party';
import Waiter from './pages/Waiter/Waiter';
import ManageMenu from "./pages/ManageMenu/ManageMenu";

import { BrowserRouter, Routes, Route } from "react-router-dom";


function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path='/admin' element={<Admin/>}/>
      <Route path="/admin/menu" element={<ManageMenu />} />

      <Route path='/waiter' element={<Waiter/>}/>
      
      <Route path='/party' element={<Party/>}/>

    </Routes>
    </BrowserRouter>
    
  );
}

export default App;
