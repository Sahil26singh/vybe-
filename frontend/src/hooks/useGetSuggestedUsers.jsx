import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetSuggestedUsers = () => {
    const { user, setSuggestedUsers } = useApp();
    useEffect(() => {
        const fetchSuggestedUsers = async () => {
            if (!user?._id) return;
            try {
                const res = await api.get('/api/v1/user/suggested', { withCredentials: true });
                if (res.data.success) { 
                    setSuggestedUsers(res.data.users);
                }
            } catch (error) {
                console.log(error);
            }
        };
        fetchSuggestedUsers();
    }, [user?._id, user?.following?.length]);
};
export default useGetSuggestedUsers;