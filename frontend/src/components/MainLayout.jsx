import React from 'react'
import { Outlet } from 'react-router-dom'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'

const MainLayout = () => {
  return (
<div className="flex">
  {/* Left Sidebar */}
  <div className="fixed left-0 top-0 h-screen w-[16%] border-r">
    <LeftSidebar />
  </div>

  {/* Main Content Scrollable Area */}
  <div className="ml-[16%] pr-0 w-[56%] h-screen overflow-y-auto">
    <Outlet />   {/* Home.jsx loads inside here */}
  </div>

  {/* Optional Right Sidebar */}
  <div className="w-[28%] h-screen overflow-y-auto border-l hidden lg:block">
    <RightSidebar />
  </div>
</div>
  )
}

export default MainLayout
