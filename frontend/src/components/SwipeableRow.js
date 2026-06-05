import React, { useRef } from 'react';
import { View, Animated, PanResponder, StyleSheet, Text, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4; // 40% of screen width

export default function SwipeableRow({ children, onSwipeLeft, onSwipeRight, enabled = true }) {
    const translateX = useRef(new Animated.Value(0)).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                if (!enabled) return false;
                // Hijack gesture only if it is mostly horizontal
                const { dx, dy } = gestureState;
                return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
            },
            onPanResponderMove: (evt, gestureState) => {
                translateX.setValue(gestureState.dx);
            },
            onPanResponderRelease: (evt, gestureState) => {
                const { dx } = gestureState;
                if (dx > SWIPE_THRESHOLD) {
                    // Swiped Right -> trigger Complete
                    Animated.timing(translateX, {
                        toValue: SCREEN_WIDTH,
                        duration: 250,
                        useNativeDriver: true,
                    }).start(() => {
                        if (onSwipeRight) onSwipeRight();
                        translateX.setValue(0);
                    });
                } else if (dx < -SWIPE_THRESHOLD) {
                    // Swiped Left -> trigger Delete
                    Animated.timing(translateX, {
                        toValue: -SCREEN_WIDTH,
                        duration: 250,
                        useNativeDriver: true,
                    }).start(() => {
                        if (onSwipeLeft) onSwipeLeft();
                        translateX.setValue(0);
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
            {/* Background Action Underlays */}
            <View style={StyleSheet.absoluteFill}>
                {/* Complete Action (revealed on swiping right) */}
                <Animated.View style={[styles.backgroundAction, styles.completeAction, { opacity: leftActionOpacity }]}>
                    <Text style={styles.actionText}>✓ Complete</Text>
                </Animated.View>

                {/* Delete Action (revealed on swiping left) */}
                <Animated.View style={[styles.backgroundAction, styles.deleteAction, { opacity: rightActionOpacity }]}>
                    <Text style={styles.actionText}>🗑️ Delete</Text>
                </Animated.View>
            </View>

            {/* Moving Foreground (The Task Card) */}
            <Animated.View
                style={{ transform: [{ translateX }] }}
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
