import React, { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';

const ProtectedRoutes = ({ children }) => {
    const { user } = useApp();
    const navigate = useNavigate();
    useEffect(() => {
        if (!user) {
            navigate("/login");
        }
    }, [user, navigate]);
    return <>{children}</>;
};

export default ProtectedRoutes;