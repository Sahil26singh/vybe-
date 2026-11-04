import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetSuggestedUsers = () => {
    const { user, setSuggestedUsers } = useApp();
    useEffect(() => {
        let isCurrent = true;
        const fetchSuggestedUsers = async () => {
            if (!user?._id) return;
            try {
                const res = await api.get('/api/v1/user/suggested');
                if (isCurrent && res.data?.success) { 
                    setSuggestedUsers(res.data.users);
                }
            } catch (error) {
                if (isCurrent) console.log(error);
            }
        };
        fetchSuggestedUsers();
        return () => {
            isCurrent = false;
        };
    }, [user?._id, user?.following?.length, setSuggestedUsers]);
};
export default useGetSuggestedUsers;
