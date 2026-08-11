import React from 'react'
import { Outlet } from 'react-router-dom'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'
import useGetSuggestedUsers from '@/hooks/useGetSuggestedUsers'

const MainLayout = () => {
  useGetSuggestedUsers();

  return (
    <div className="flex">
      {/* Left Sidebar — hidden on mobile, icon-only on md, full on lg+ */}
      <div className="fixed left-0 top-0 h-screen border-r hidden md:block
                      md:w-[72px] lg:w-[16%] z-20">
        <LeftSidebar />
      </div>

      {/* Main Content Scrollable Area */}
      <div className="
        w-full h-screen overflow-y-auto
        md:ml-[72px] md:w-[calc(100%-72px)]
        lg:ml-[16%]  lg:w-[56%]
        pb-16 md:pb-0
      ">
        <Outlet />
      </div>

      {/* Right Sidebar */}
      <div className="w-[28%] h-screen overflow-y-auto border-l hidden lg:block">
        <RightSidebar />
      </div>
    </div>
  )
}

export default MainLayout
