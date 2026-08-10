import { useApp } from "@/context/AppContext";
import api, { API_URL } from "@/lib/axios";
import { useEffect } from "react";

const useGetUserProfile = (userId) => {
    const { setUserProfile } = useApp();
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userId) return;
            try {
                const res = await api.get(`${API_URL}/api/v1/user/${userId}/profile`, { withCredentials: true });
                if (res.data.success) { 
                    setUserProfile(res.data.user);
                }
            } catch (error) {
                console.log(error);
            }
        };
        fetchUserProfile();
    }, [userId]);
};
export default useGetUserProfile;