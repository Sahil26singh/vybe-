import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetUserProfile = (userId) => {
    const { setUserProfile } = useApp();
    useEffect(() => {
        let isCurrent = true;
        const fetchUserProfile = async () => {
            if (!userId) return;
            try {
                const res = await api.get(`/api/v1/user/${userId}/profile`);
                if (isCurrent && res.data?.success) { 
                    setUserProfile(res.data.user);
                }
            } catch (error) {
                if (isCurrent) console.log(error);
            }
        };
        fetchUserProfile();
        return () => {
            isCurrent = false;
        };
    }, [userId, setUserProfile]);
};
export default useGetUserProfile;
