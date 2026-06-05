import React, { useRef, useEffect } from 'react';
import { View, Animated, PanResponder, StyleSheet, Text, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4; // 40% of screen width

export default function SwipeableRow({ children, onSwipeLeft, onSwipeRight, enabled = true, taskId, onSwipeStart, onSwipeRelease }) {
    const translateX = useRef(new Animated.Value(0)).current;

    // Reset translation if the task ID changes (prevents FlatList recycling bugs)
    useEffect(() => {
        translateX.setValue(0);
    }, [taskId]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                if (!enabled) return false;
                const { dx, dy } = gestureState;
                // Hijack gesture only if it is mostly horizontal
                return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
            },
            onPanResponderGrant: (evt, gestureState) => {
                if (onSwipeStart) onSwipeStart();
            },
            onPanResponderMove: (evt, gestureState) => {
                translateX.setValue(gestureState.dx);
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (onSwipeRelease) onSwipeRelease();
                const { dx } = gestureState;
                if (dx > SWIPE_THRESHOLD) {
                    // Swiped Right -> trigger Complete
                    Animated.spring(translateX, {
                        toValue: 0,
                        friction: 6,
                        tension: 50,
                        useNativeDriver: true,
                    }).start(() => {
                        if (onSwipeRight) onSwipeRight();
                    });
                } else if (dx < -SWIPE_THRESHOLD) {
                    // Swiped Left -> trigger Delete
                    Animated.spring(translateX, {
                        toValue: 0,
                        friction: 6,
                        tension: 50,
                        useNativeDriver: true,
                    }).start(() => {
                        if (onSwipeLeft) onSwipeLeft();
                    });
                } else {
                    // Snap back to center
                    Animated.spring(translateX, {
                        toValue: 0,
                        friction: 5,
                        tension: 40,
                        useNativeDriver: true,
                    }).start();
                }
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderTerminate: (evt, gestureState) => {
                if (onSwipeRelease) onSwipeRelease();
                // Snap back to center on termination
                Animated.spring(translateX, {
                    toValue: 0,
                    friction: 5,
                    tension: 40,
                    useNativeDriver: true,
                }).start();
            },
        })
    ).current;

    // Animate background action opacities based on swipe direction
    const leftActionOpacity = translateX.interpolate({
        inputRange: [0, SWIPE_THRESHOLD],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    const rightActionOpacity = translateX.interpolate({
        inputRange: [-SWIPE_THRESHOLD, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.container}>
            {/* Background Action Underlays (zIndex: 1) */}
            <View style={[styles.underlayContainer, { zIndex: 1 }]}>
                {/* Complete Action (revealed on swiping right) */}
                <Animated.View style={[styles.backgroundAction, styles.completeAction, { opacity: leftActionOpacity }]}>
                    <Text style={styles.actionText}>✓ Complete</Text>
                </Animated.View>

                {/* Delete Action (revealed on swiping left) */}
                <Animated.View style={[styles.backgroundAction, styles.deleteAction, { opacity: rightActionOpacity }]}>
                    <Text style={styles.actionText}>🗑️ Delete</Text>
                </Animated.View>
            </View>

            {/* Moving Foreground (The Task Card, zIndex: 2) */}
            <Animated.View
                style={[styles.foregroundContainer, { transform: [{ translateX }], zIndex: 2 }]}
                {...panResponder.panHandlers}
            >
                {children}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'hidden',
    },
    underlayContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    foregroundContainer: {
        backgroundColor: 'transparent',
    },
    backgroundAction: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 12,
    },
    completeAction: {
        backgroundColor: '#10b981', // emerald-500
        justifyContent: 'flex-start',
    },
    deleteAction: {
        backgroundColor: '#ef4444', // red-500
        justifyContent: 'flex-end',
    },
    actionText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
});
